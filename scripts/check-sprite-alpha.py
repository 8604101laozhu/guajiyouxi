#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""投放门禁：进游戏前检查序列帧是不是「真透明 PNG + 单角色」。

为什么要这道门禁
----------------
W2 出的帧是**纯色底**的普通图片，必须过 W3（BiRefNet）抠成真透明 PNG 才能进
`public/sprites`。跳过 W3、或 W3 失败退回烂抠图、或直接拿带白底的图投放，
在游戏里就会看到：

    · 人物周围一圈块状白边
    · 背后黑白噪点、碎渣
    · 边缘锯齿重（没有羽化过渡）

这些脏边一旦糊进角色轮廓，后期 rembg 救不回来 —— 只能回 W3 重出。
所以宁可在这里挡下来，也不要在游戏里补抠。

判定标准与阈值来自工具箱 `pages/phone/matting_w3.py`（单一事实来源）。
连得上工具箱就用它的 `check_frame`；连不上则用本文件内置的等价实现，
并在输出里**明确告警**，避免「悄悄降级后误判通过」。

用法
----
    python check-sprite-alpha.py <文件夹> [<文件夹> ...] [选项]

<文件夹> 可以是：
    · 角色目录（含 走路/walking、攻击/attack、死亡/death、待机/idle 子目录）
    · 单个动作目录（直接放 00.png 01.png …）

选项：
    --toolkit DIR   工具箱根目录（也可用环境变量 XIANGCAO_TOOLKIT）
    --json          以 JSON 输出（给脚本/CI 用）
    --quiet         只输出结论与失败帧
    --list          只列出会检查的目录，不检查

退出码：
    0 = 全部 PASS，可以投放
    1 = 有 FAIL，回 W3 重出，不要投放
    2 = 用法/环境错误（比如没有可检查的目录）
"""

import argparse
import json
import os
import sys

# Windows 控制台默认 GBK，中文和符号会炸；统一成 UTF-8
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# 阈值 —— 必须与工具箱 pages/phone/matting_w3.py 保持一致
ACCEPT_MIN_ALPHA0 = 15.0      # 全透明像素占比下限
ACCEPT_MAX_OPAQUE = 60.0      # 不透明占比上限
ACCEPT_MAX_EDGE_WHITE = 25.0  # 边缘接近纯白的比例上限
ACCEPT_MAX_SPECKS = 20        # 孤立碎渣数量上限
SPECKS_MIN_AREA = 64          # 小于此面积且离主体 >4px 才算碎渣

# 动作目录的常见命名（中英都认）
ACTION_ALIASES = {
    'walking': ['走路', 'walking', 'walk'],
    'attack': ['攻击', 'attack'],
    'death': ['死亡', 'death'],
    'idle': ['待机', 'idle', 'stand'],
}

DEFAULT_TOOLKITS = [
    os.environ.get('XIANGCAO_TOOLKIT') or '',
    r'F:\BaiduNetdisk\minimax\MiniMaxH3\ben-M3-V03\ben-M3-V03',
]


# --------------------------------------------------------------- 内置指标实现

def _builtin_frame_metrics(path):
    """与 matting_w3.frame_metrics 等价的实现（连不上工具箱时用）。

    关键点（踩过的坑，别改回去）：
      · 碎渣不能用「alpha>=250 的 4 连通小块」判 —— 软 alpha 的角色轮廓本身
        就是锯齿状，会沿边缘产生几百个 <30px 的孤立 4 连通块，把正常羽化
        误报成噪点（实测把干净的 BiRefNet 输出判成 476 个碎渣）。
        正确做法：中间阈值 alpha>=128 下取 **8 连通**，只有「面积 < 64px」
        **且**「离主体 > 4px」的孤立块才算碎渣。
      · 必须单独统计「独立主体数」，才能抓出 2x2 拼图 / 多角色图。
    """
    import numpy as np
    from PIL import Image

    with Image.open(path) as im:
        bands = ''.join(im.getbands())
        arr = np.array(im.convert('RGBA'))
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3].astype('int16')

    opaque = alpha >= 250
    clear = alpha <= 5
    semi = (~opaque) & (~clear)

    edge_white = 0.0
    specks = 0
    subjects = 0
    blobs = 0
    try:
        from scipy import ndimage

        # 边缘 = 不透明且紧邻透明区
        near_clear = ndimage.binary_dilation(clear, iterations=2)
        edge = opaque & near_clear
        if edge.any():
            e = rgb[edge]
            edge_white = float((e.min(axis=1) >= 235).mean()) * 100.0

        mid = alpha >= 128
        label, n = ndimage.label(mid, structure=np.ones((3, 3), dtype=int))
        blobs = int(n)
        if n:
            sizes = np.bincount(label.ravel())
            sizes[0] = 0
            main = int(np.argmax(sizes))
            main_area = int(sizes[main])
            big_min = max(SPECKS_MIN_AREA, int(main_area * 0.02))
            subjects = int(((sizes >= big_min) & (sizes > 0)).sum())

            near_main = ndimage.binary_dilation(label == main, iterations=4)
            touching = np.unique(label[near_main])
            small = np.where((sizes > 0) & (sizes < SPECKS_MIN_AREA))[0]
            specks = int(small.size - np.isin(small, touching).sum())
    except Exception:
        pass

    return {
        'path': path,
        'has_alpha': 'A' in bands and bands.endswith('A'),
        'mode': bands,
        'size': '%dx%d' % (im.width, im.height),
        'opaque_pct': float(opaque.mean()) * 100.0,
        'clear_pct': float(clear.mean()) * 100.0,
        'semi_pct': float(semi.mean()) * 100.0,
        'edge_white_pct': edge_white,
        'specks': max(0, specks),
        'subjects': subjects,
        'blobs': blobs,
    }


def _builtin_check_frame(path):
    try:
        m = _builtin_frame_metrics(path)
    except Exception as e:
        return {'path': path, 'ok': False, 'issues': ['读帧失败：%s' % e]}

    issues = []
    if not m['has_alpha']:
        issues.append('没有 alpha 通道（不是真透明 PNG）')
    else:
        if m['opaque_pct'] >= ACCEPT_MAX_OPAQUE:
            issues.append('不透明 %.1f%%，背景可能没抠干净' % m['opaque_pct'])
        if m['clear_pct'] < ACCEPT_MIN_ALPHA0:
            issues.append('全透明仅 %.1f%%，背景基本没删掉' % m['clear_pct'])
    if m['edge_white_pct'] >= ACCEPT_MAX_EDGE_WHITE:
        issues.append('边缘纯白 %.1f%%，有白边/白晕' % m['edge_white_pct'])
    if m['specks'] >= ACCEPT_MAX_SPECKS:
        issues.append('孤立碎渣 %d 个，背景有噪点/碎块' % m['specks'])
    if m['subjects'] > 1:
        issues.append('画面里有 %d 个独立主体（拼图/多角色），不是单角色帧' % m['subjects'])
    m['issues'] = issues
    m['ok'] = not issues
    return m


# --------------------------------------------------------------- 工具箱接入

def _load_checker(toolkit):
    """优先用工具箱的 check_frame（单一事实来源）。返回 (函数, 来源说明)。"""
    candidates = [p for p in ([toolkit] if toolkit else []) + DEFAULT_TOOLKITS if p]
    tried = []
    for root in candidates:
        if not os.path.isdir(root):
            tried.append('%s (不存在)' % root)
            continue
        if not os.path.isdir(os.path.join(root, 'pages', 'phone')):
            tried.append('%s (不是工具箱根目录)' % root)
            continue
        try:
            if root not in sys.path:
                sys.path.insert(0, root)
            from pages.phone.matting_w3 import check_frame  # noqa
            return check_frame, '工具箱 %s' % root
        except Exception as e:
            tried.append('%s (%s: %s)' % (root, type(e).__name__, e))
    return _builtin_check_frame, '内置副本（工具箱不可用）'


# --------------------------------------------------------------- 目录发现

def _is_action_dir(path):
    if not os.path.isdir(path):
        return False
    return any(f.lower().endswith('.png') for f in os.listdir(path))


def _normalize(name):
    return (name or '').strip().lower().replace('_', '').replace('-', '').replace(' ', '')


def _canon_action(name):
    """把目录名归一到 walking/attack/death/idle，认不出返回 ''。"""
    n = _normalize(name)
    for canon, aliases in ACTION_ALIASES.items():
        for a in aliases:
            if n == _normalize(a):
                return canon
    return ''


def _pngs(folder):
    return sorted(
        os.path.join(folder, f) for f in os.listdir(folder)
        if f.lower().endswith('.png') and not f.startswith('_')
    )


SKIP_DIRS = {'_backup', 'node_modules', '.git', '.next', 'temp'}


def discover_groups(root, max_depth=3):
    """把输入目录展开成 [(动作名, 目录, [png...])]。

    真实目录布局见过好几种，都要认：
      · 角色目录/走路、角色目录/攻击        （工具箱导出）
      · 角色目录/sprites/walk               （旧导出）
      · 角色目录/walking                    （游戏工程风格）
      · 动作目录本身（直接放 00.png 01.png）
    """
    if not os.path.isdir(root):
        return []
    groups = []
    seen = set()

    for dp, dns, fns in os.walk(root):
        # 跳过备份/依赖目录，别把历史垃圾也算进来
        dns[:] = [d for d in dns
                  if d.lower() not in SKIP_DIRS
                  and not d.startswith('_')
                  and not d.lower().endswith('-old')]
        rel = os.path.relpath(dp, root)
        depth = 0 if rel == '.' else rel.count(os.sep) + 1
        if depth > max_depth:
            dns[:] = []
            continue
        canon = _canon_action(os.path.basename(dp))
        if canon and dp not in seen:
            pngs = _pngs(dp)
            if pngs:
                seen.add(dp)
                groups.append((canon, dp, pngs))

    # 根目录直接摊了一堆 png，又没有动作子目录 → 当成一组
    if root not in seen and _is_action_dir(root):
        pngs = _pngs(root)
        if pngs:
            name = os.path.basename(os.path.normpath(root)) or root
            groups.append((name, root, pngs))

    return groups


# --------------------------------------------------------------- 输出

def _fmt_row(r):
    return ('  %-12s %-6s %8.1f %8.1f %7.2f %9.1f %7d %7d'
            % (os.path.basename(r.get('path', '?')), r.get('mode', '?'),
               r.get('opaque_pct', 0), r.get('clear_pct', 0),
               r.get('semi_pct', 0), r.get('edge_white_pct', 0),
               r.get('specks', 0), r.get('subjects', 0)))


HEADER = ('  %-12s %-6s %8s %8s %7s %9s %7s %7s'
          % ('frame', 'mode', '不透明%', '全透明%', '半透明%', '边缘白%', '碎渣', '主体'))


def main(argv=None):
    ap = argparse.ArgumentParser(add_help=True, description='序列帧透明底投放门禁')
    ap.add_argument('paths', nargs='*', help='角色目录或动作目录（可多个）')
    ap.add_argument('--toolkit', default='', help='工具箱根目录')
    ap.add_argument('--json', action='store_true', help='JSON 输出')
    ap.add_argument('--quiet', action='store_true', help='只输出结论与失败帧')
    ap.add_argument('--list', action='store_true', help='只列出会检查的目录')
    args = ap.parse_args(argv)

    roots = args.paths or [os.getcwd()]
    groups = []
    for r in roots:
        groups.extend(discover_groups(r))

    if args.list:
        for name, folder, pngs in groups:
            print('%s  (%d 帧)  %s' % (name, len(pngs), folder))
        if not groups:
            print('没有找到可检查的目录', file=sys.stderr)
            return 2
        return 0

    if not groups:
        print('没有找到可检查的目录。', file=sys.stderr)
        print('传入角色目录（含 走路/攻击/死亡/待机）或单个动作目录。', file=sys.stderr)
        for r in roots:
            print('  已查看：%s' % r, file=sys.stderr)
        return 2

    check_frame, source = _load_checker(args.toolkit)

    warn = ''
    if '内置副本' in source:
        warn = ('警告：连不上工具箱，阈值用内置副本。'
                '若工具箱里的阈值改了，这里可能不一致 —— 用 --toolkit 指定路径。')

    all_rows = []
    folder_results = []
    for name, folder, pngs in groups:
        rows = [check_frame(p) for p in pngs]
        for r in rows:
            r['group'] = name
        bad = [r for r in rows if not r.get('ok')]
        all_rows.extend(rows)
        folder_results.append({
            'group': name, 'folder': folder,
            'total': len(rows), 'bad': len(bad),
            'ok': not bad, 'rows': rows,
        })

    total = len(all_rows)
    bad_all = [r for r in all_rows if not r.get('ok')]

    if args.json:
        print(json.dumps({
            'ok': not bad_all, 'total': total, 'bad': len(bad_all),
            'source': source, 'degraded': '内置副本' in source,
            'folders': folder_results,
        }, ensure_ascii=False, indent=2))
        return 0 if not bad_all else 1

    print('=' * 74)
    print('投放门禁：真透明 PNG 检查')
    print('判定来源：%s' % source)
    if warn:
        print(warn)
    print('=' * 74)

    for fr in folder_results:
        status = 'PASS' if fr['ok'] else 'FAIL'
        print()
        print('[%s] %s  (%d 帧)  %s' % (status, fr['group'], fr['total'], fr['folder']))
        if not args.quiet:
            print(HEADER)
            for r in fr['rows']:
                print(_fmt_row(r))
        for r in fr['rows']:
            if not r.get('ok'):
                print('  !! %s' % os.path.basename(r.get('path', '?')))
                for iss in r.get('issues') or []:
                    print('       - %s' % iss)

    print()
    print('-' * 74)
    print('合计：%d 帧，%d 帧未通过' % (total, len(bad_all)))
    if bad_all:
        print()
        print('结论：FAIL —— 不要投放。')
        print('  回工具箱（动作循环页面）重跑 W3 BiRefNet，再导出一次。')
        print('  已经糊进角色轮廓的脏边，在游戏里补抠救不回来。')
        return 1
    print()
    print('结论：PASS —— %d 帧全部达标，可以投放。' % total)
    return 0


if __name__ == '__main__':
    sys.exit(main())
