"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  BASES,
  characterAttackRating,
  createCharacter,
  combatPower,
  defaultSlotForKind,
  equipItem,
  farmStage,
  generateForSlot,
  generateItem,
  getBase,
  getStage,
  ITEM_KINDS,
  mulberry32,
  QUALITY_NAME,
  swing,
  totalAttributes,
  unequip,
  type Character,
  type DifficultyId,
  type FarmResult,
  type HitRoll,
  type Item,
  type ItemKind,
  type Quality,
  type SlotId,
} from "@/lib/d2";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CampaignBench } from "./campaign-bench";
import { DamageStudio } from "./damage-studio";
import { qualityTint } from "./item-tooltip";
import { ItemTooltip } from "./item-tooltip";
import { cosmeticFromWeaponClass, type CosmeticName } from "@/lib/sprites/catalog";
import { PaperDoll } from "./paper-doll";
import { MageWalkStudio } from "./walk-guide";

const STORAGE_KEY = "guajiyouxi-v1";

type Persist = {
  character: Character;
  inventory: Item[];
  areaLevel: number;
  magicFind: number;
  dummyDefense: number;
  dummyLevel: number;
  showRange: boolean;
  chapter: number;
  stage: number;
  difficulty: DifficultyId;
  gold: number;
};

function loadState(): Persist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persist;
  } catch {
    return null;
  }
}

const KIND_LABEL: Record<ItemKind, string> = {
  helm: "头盔",
  armor: "盔甲",
  belt: "腰带",
  gloves: "手套",
  boots: "靴子",
  amulet: "项链",
  ring: "戒指",
  weapon: "武器",
  shield: "盾牌",
};

export function GameClient() {
  const [character, setCharacter] = useState<Character>(createCharacter);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [areaLevel, setAreaLevel] = useState(30);
  const [magicFind, setMagicFind] = useState(0);
  const [dummyDefense, setDummyDefense] = useState(200);
  const [dummyLevel, setDummyLevel] = useState(30);
  const [showRange, setShowRange] = useState(true);
  const [chapter, setChapter] = useState(1);
  const [stage, setStage] = useState(1);
  const [difficulty, setDifficulty] = useState<DifficultyId>("normal");
  const [gold, setGold] = useState(0);
  const [lastFarm, setLastFarm] = useState<FarmResult | null>(null);
  const [labOpen, setLabOpen] = useState(true);
  const [quality, setQuality] = useState<Quality | "random">("random");
  const [kind, setKind] = useState<ItemKind | "random">("random");
  const [count, setCount] = useState(10);
  const [hits, setHits] = useState<HitRoll[]>([]);
  const [auto, setAuto] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [seedTick, setSeedTick] = useState(1);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage after mount */
    const saved = loadState();
    if (saved) {
      setCharacter(saved.character);
      setInventory(saved.inventory);
      setAreaLevel(saved.areaLevel);
      setMagicFind(saved.magicFind);
      setDummyDefense(saved.dummyDefense);
      setDummyLevel(saved.dummyLevel);
      setShowRange(saved.showRange);
      if (saved.chapter) setChapter(saved.chapter);
      if (saved.stage) setStage(saved.stage);
      if (saved.difficulty) setDifficulty(saved.difficulty);
      if (typeof saved.gold === "number") setGold(saved.gold);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: Persist = {
      character,
      inventory,
      areaLevel,
      magicFind,
      dummyDefense,
      dummyLevel,
      showRange,
      chapter,
      stage,
      difficulty,
      gold,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [character, inventory, areaLevel, magicFind, dummyDefense, dummyLevel, showRange, chapter, stage, difficulty, gold, hydrated]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const worn = Object.entries(character.equipment).find(([, item]) => item?.id === selectedId);
    if (worn?.[1]) return { item: worn[1], slot: worn[0] as SlotId, from: "worn" as const };
    const bag = inventory.find((item) => item.id === selectedId);
    if (bag) return { item: bag, slot: undefined, from: "bag" as const };
    return null;
  }, [selectedId, character.equipment, inventory]);

  const equippedCosmetic = cosmeticFromWeaponClass(
    character.equipment.mainHand ? getBase(character.equipment.mainHand.baseId).weaponClass : undefined,
  );
  const gearMf = totalAttributes(character).stats.magicFind;
  const totalMf = gearMf + magicFind;

  function nextRng() {
    const seed = (Date.now() ^ (seedTick * 2654435761)) >>> 0;
    setSeedTick((n) => n + 1);
    return { rng: mulberry32(seed), seed };
  }

  function flash(text: string) {
    setNotice(text);
  }

  function dropItems(items: Item[]) {
    setInventory((prev) => [...items, ...prev].slice(0, 80));
    setSelectedId(items[0]?.id ?? selectedId);
    flash(`掉落 ${items.length} 件`);
  }

  function generateLoot() {
    const { seed } = nextRng();
    const monster = getStage(chapter, stage, difficulty);
    const items: Item[] = [];
    for (let i = 0; i < count; i++) {
      const itemRng = mulberry32((seed + i * 9973) >>> 0);
      items.push(
        generateItem({
          rng: itemRng,
          ilvl: monster.tcLevel,
          mlvl: monster.mlvl,
          magicFind: totalMf,
          uber: monster.uber,
          jewelryChance: monster.jewelryChance,
          kind: kind === "random" ? undefined : kind,
          quality: quality === "random" ? undefined : quality,
          seed: (seed + i) >>> 0,
        }),
      );
    }
    dropItems(items);
  }

  function selectStage(nextChapter: number, nextStage: number, nextDiff: DifficultyId) {
    setChapter(nextChapter);
    setStage(nextStage);
    setDifficulty(nextDiff);
    const monster = getStage(nextChapter, nextStage, nextDiff);
    setDummyDefense(monster.defense);
    setDummyLevel(monster.mlvl);
    setAreaLevel(monster.tcLevel);
  }

  function applyFarm(result: FarmResult, summary?: string) {
    setLastFarm(result);
    setDummyDefense(result.monster.defense);
    setDummyLevel(result.monster.mlvl);
    if (!result.ok) {
      flash(result.reason);
      return;
    }
    setGold((value) => value + result.gold);
    if (result.items.length) {
      setInventory((prev) => [...result.items, ...prev].slice(0, 80));
      setSelectedId(result.items[0]?.id ?? selectedId);
    }
    flash(summary ?? `${result.reason} · 金币 +${result.gold} · 装备 ${result.items.length} · 空箱 ${result.noDrops}/${result.picks}`);
  }

  function runFarm() {
    const { rng, seed } = nextRng();
    applyFarm(
      farmStage({
        rng,
        seed,
        chapter,
        stage,
        difficulty,
        magicFind: totalMf,
        power: combatPower(character),
      }),
    );
  }

  function runFarmMany() {
    const { seed } = nextRng();
    const bag: Item[] = [];
    let goldGain = 0;
    let noDrops = 0;
    let picks = 0;
    let last: FarmResult | null = null;
    let waves = 0;
    for (let i = 0; i < 10; i++) {
      const result = farmStage({
        rng: mulberry32((seed + i * 7919) >>> 0),
        seed: seed + i,
        chapter,
        stage,
        difficulty,
        magicFind: totalMf,
        power: combatPower(character),
      });
      last = result;
      if (!result.ok) break;
      waves += 1;
      goldGain += result.gold;
      noDrops += result.noDrops;
      picks += result.picks;
      bag.push(...result.items);
    }
    if (!last) return;
    applyFarm(
      { ...last, gold: goldGain, items: bag, noDrops, picks },
      last.ok
        ? `挂机 ${waves} 波 · 金币 +${goldGain} · 装备 ${bag.length} · 空箱 ${noDrops}/${picks}`
        : last.reason,
    );
  }

  function generateWhites() {
    const { seed } = nextRng();
    const slots: SlotId[] = ["helm", "armor", "belt", "gloves", "boots", "amulet", "ringLeft", "ringRight", "mainHand", "offHand"];
    const items = slots.map((slot, index) =>
      generateForSlot({
        rng: mulberry32((seed + index * 1337) >>> 0),
        ilvl: Math.min(areaLevel, 20),
        quality: "normal",
        slot,
        seed: seed + index,
      }),
    );
    dropItems(items);
  }

  function tryEquip(item: Item, slot?: SlotId) {
    const target = slot ?? pickSlot(item, character);
    if (!target) {
      flash("没有能放的部位");
      return;
    }
    const result = equipItem(character, item, target);
    if (!result.ok) {
      flash(result.reason);
      return;
    }
    setCharacter({ ...character, equipment: result.equipment });
    setInventory((prev) => {
      const without = prev.filter((entry) => entry.id !== item.id);
      return [...result.replaced, ...without];
    });
    setSelectedId(item.id);
    flash(`已装备到${targetLabel(target)}`);
  }

  function tryUnequip(slot: SlotId) {
    const { equipment, item } = unequip(character, slot);
    setCharacter({ ...character, equipment });
    if (item) {
      setInventory((prev) => [item, ...prev].slice(0, 80));
      setSelectedId(item.id);
    }
  }

  function swapMainHandCosmetic(cosmetic: CosmeticName) {
    if (cosmetic === "unarmed") {
      if (character.equipment.mainHand) tryUnequip("mainHand");
      return;
    }
    if (equippedCosmetic === cosmetic && character.equipment.mainHand) return;
    const fromBag = inventory.find(
      (item) => cosmeticFromWeaponClass(getBase(item.baseId).weaponClass) === cosmetic,
    );
    if (fromBag) {
      tryEquip(fromBag, "mainHand");
      return;
    }
    const { seed } = nextRng();
    const item = generateItem({
      rng: mulberry32(seed),
      ilvl: areaLevel,
      quality: "normal",
      baseId: cosmetic === "staff" ? "short_staff" : "short_sword",
      seed,
    });
    tryEquip(item, "mainHand");
  }

  function discard(item: Item) {
    setInventory((prev) => prev.filter((entry) => entry.id !== item.id));
    const worn = Object.entries(character.equipment).find(([, wornItem]) => wornItem?.id === item.id);
    if (worn) {
      const { equipment } = unequip(character, worn[0] as SlotId);
      setCharacter({ ...character, equipment });
    }
    if (selectedId === item.id) setSelectedId(null);
  }

  function doSwing() {
    const { rng } = nextRng();
    const ar = characterAttackRating(character);
    const hit = swing(rng, character, { defense: dummyDefense, level: dummyLevel }, ar);
    setHits((prev) => [hit, ...prev].slice(0, 40));
  }

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      const seed = (Date.now() ^ 0x9e3779b9) >>> 0;
      const ar = characterAttackRating(character);
      const hit = swing(mulberry32(seed), character, { defense: dummyDefense, level: dummyLevel }, ar);
      setHits((prev) => [hit, ...prev].slice(0, 40));
    }, 420);
    return () => window.clearInterval(id);
  }, [auto, character, dummyDefense, dummyLevel]);

  function setAttr(key: "str" | "dex" | "vit" | "nrg" | "level", value: number) {
    if (key === "level") {
      setCharacter({ ...character, level: value });
      return;
    }
    setCharacter({ ...character, base: { ...character.base, [key]: value } });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2 border-b border-[#6a5428] pb-4">
        <p className="text-xs tracking-[0.35em] text-[#c7a24a]">GUAJIYOUXI · 挂机游戏</p>
        <h1 className="text-2xl font-semibold text-[#f0ead8] sm:text-3xl">暗黑 2 掉落 · 手游关卡梯度</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#cfc3a6]">
          单件怎么出还是暗黑 2：TC 抽基底，ItemRatio 走暗金→套装→稀有→魔法。关卡血量、推荐战力、抽次和空箱按现在挂机手游的章节难度抬。左侧动作循环：走路 / 攻击 / 死亡共用一条 W2，换武器只换 W4 层。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section id="mage-walk" className="border border-[#6a5428] bg-[#120e0a] p-4">
          <MageWalkStudio cosmetic={equippedCosmetic} onCosmetic={swapMainHandCosmetic} />
        </section>
        <CampaignBench
          character={character}
          gearMf={gearMf}
          extraMf={magicFind}
          onExtraMf={setMagicFind}
          chapter={chapter}
          stage={stage}
          difficulty={difficulty}
          gold={gold}
          lastFarm={lastFarm}
          onChapter={(n) => selectStage(n, stage, difficulty)}
          onStage={(n) => selectStage(chapter, n, difficulty)}
          onDifficulty={(d) => selectStage(chapter, stage, d)}
          onFarm={runFarm}
          onFarmMany={runFarmMany}
        />
      </div>

      <section className="flex flex-col gap-3 border border-[#6a5428] bg-[#140f0a] p-4">
        <button type="button" className="text-left text-xs tracking-[0.2em] text-[#c7a24a]" onClick={() => setLabOpen((v) => !v)}>
          {labOpen ? "收起实验室" : "实验室（强制品质 / 白板套）"}
        </button>
        {labOpen ? (
          <div className="flex flex-wrap gap-2">
            <Select
              value={quality}
              onChange={(value) => setQuality(value as Quality | "random")}
              options={[
                ["random", "品质：按 ItemRatio 掷"],
                ["normal", "强制普通"],
                ["magic", "强制魔法"],
                ["rare", "强制稀有"],
                ["unique", "强制暗金"],
              ]}
            />
            <Select
              value={kind}
              onChange={(value) => setKind(value as ItemKind | "random")}
              options={[["random", "部位：随机"], ...ITEM_KINDS.map((id) => [id, KIND_LABEL[id]] as const)]}
            />
            <Select
              value={String(count)}
              onChange={(value) => setCount(Number(value))}
              options={[
                ["1", "掉 1 件"],
                ["10", "掉 10 件"],
                ["40", "掉 40 件"],
              ]}
            />
            <Button type="button" onClick={generateLoot}>
              按当前关卡 TC 生成
            </Button>
            <Button type="button" variant="outline" onClick={generateWhites}>
              生成白板十件套
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowRange((v) => !v)}>
              {showRange ? "隐藏掷骰范围" : "显示掷骰范围"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setInventory([]);
                setHits([]);
                flash("背包已清空");
              }}
            >
              清空背包
            </Button>
          </div>
        ) : null}
        {notice ? <p className="text-sm text-[#c7a24a]">{notice}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)]">
        <section className="border border-[#6a5428] bg-[#120e0a] p-4">
          <p className="mb-3 text-xs tracking-[0.2em] text-[#c7a24a]">人物（十部位）</p>
          <PaperDoll
            character={character}
            selectedId={selectedId}
            onSelect={(item) => setSelectedId(item.id)}
            onCosmetic={swapMainHandCosmetic}
          />
          <div className="mt-4 space-y-2">
            <Field label={`等级 ${character.level}`}>
              <Slider value={[character.level]} min={1} max={99} onValueChange={(v) => setAttr("level", sliderNumber(v))} />
            </Field>
            <Field label={`力量 ${character.base.str}`}>
              <Slider value={[character.base.str]} min={0} max={250} onValueChange={(v) => setAttr("str", sliderNumber(v))} />
            </Field>
            <Field label={`敏捷 ${character.base.dex}`}>
              <Slider value={[character.base.dex]} min={0} max={250} onValueChange={(v) => setAttr("dex", sliderNumber(v))} />
            </Field>
            <p className="text-[11px] text-[#8a7a5a]">力量/敏捷滑条改的是人物基底，用来对伤害公式。装备上的力量会另行加算。</p>
          </div>
        </section>

        <section className="border border-[#6a5428] bg-[#120e0a] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs tracking-[0.2em] text-[#c7a24a]">背包 {inventory.length}/80</p>
            {!hydrated ? <p className="text-xs text-[#8a7a5a]">读取本地存档…</p> : null}
          </div>
          {inventory.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#8a7a5a]">还没有掉落。先清剿一关，或打开实验室强制出货。</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {inventory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "flex min-h-16 flex-col items-start border border-[#3a2a18] bg-[#1a140c] px-2 py-2 text-left hover:border-[#c7a24a]",
                    selectedId === item.id && "border-[#c7a24a]",
                  )}
                >
                  <span className="text-[12px] leading-4" style={{ color: qualityTint(item.quality) }}>
                    {item.name}
                  </span>
                  <span className="text-[10px] text-[#8a7a5a]">
                    {QUALITY_NAME[item.quality]} · {getBase(item.baseId).name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="border border-[#6a5428] bg-[#120e0a] p-4">
          <p className="mb-3 text-xs tracking-[0.2em] text-[#c7a24a]">选中物品</p>
          {selected ? (
            <div className="flex flex-col gap-3">
              <ItemTooltip item={selected.item} showRange={showRange} slotLabel={selected.slot ? targetLabel(selected.slot) : undefined} />
              <div className="flex flex-wrap gap-2">
                {selected.from === "bag" ? (
                  <Button type="button" onClick={() => tryEquip(selected.item)}>
                    装备
                  </Button>
                ) : selected.slot ? (
                  <Button type="button" variant="outline" onClick={() => tryUnequip(selected.slot!)}>
                    卸下
                  </Button>
                ) : null}
                <Button type="button" variant="destructive" onClick={() => discard(selected.item)}>
                  丢弃
                </Button>
              </div>
              {selected.from === "bag" && getBase(selected.item.baseId).kind === "ring" ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => tryEquip(selected.item, "ringLeft")}>
                    戴左戒
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => tryEquip(selected.item, "ringRight")}>
                    戴右戒
                  </Button>
                </div>
              ) : null}
              {selected.from === "bag" && getBase(selected.item.baseId).kind === "weapon" && !getBase(selected.item.baseId).twoHanded ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => tryEquip(selected.item, "mainHand")}>
                    主手
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => tryEquip(selected.item, "offHand")}>
                    副手
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[#8a7a5a]">点背包或身上的装备查看词缀。打开「显示掷骰范围」能看到这条词缀生成时的 min–max。</p>
          )}
        </section>
      </div>

      <section className="border border-[#6a5428] bg-[#120e0a] p-4">
        <DamageStudio
          character={character}
          dummyDefense={dummyDefense}
          dummyLevel={dummyLevel}
          extraMf={magicFind}
          hits={hits}
          onSwing={doSwing}
          auto={auto}
          onToggleAuto={() => setAuto((v) => !v)}
        />
      </section>

      <section className="border border-[#6a5428] bg-[#140f0a] p-4 text-sm leading-6 text-[#cfc3a6]">
        <p className="text-xs tracking-[0.2em] text-[#c7a24a]">公式底子</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>掉落先抽 TC 基底（qlvl 带宽随关卡走），再按 ItemRatio 判定品质。</li>
          <li>品质链：暗金 → 套装（空表则继续）→ 稀有 → 魔法 → 白板。MF 暗金 250 衰减、稀有 600，魔法不衰减。</li>
          <li>普通/精英/噩梦/地狱改变血量、推荐战力、抽次、空箱率和是否走 Uber 品质行。</li>
          <li>武器基底伤害；无形 ×1.5。</li>
          <li>只乘武器上的 %增强伤害，再加上武器上的 +最小 / +最大。</li>
          <li>装外 %增强伤害与力量（近战）或敏捷（弓弩标枪）加算后乘上去。</li>
          <li>火/冰/电/毒各自掷骰。致命一击与死伤不叠加。</li>
        </ol>
        <p className="mt-3 text-[12px] text-[#8a7a5a]">
          基底种类 {BASES.length} ，词缀会按物品等级和组别互斥。暗金目前是对照表，基底没有暗金时会掉成稀有。镶孔只有数量，宝石和符文之语还没接。
        </p>
      </section>
    </div>
  );
}

function sliderNumber(value: number | readonly number[]): number {
  return typeof value === "number" ? value : (value[0] ?? 0);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-xs text-[#cfc3a6]">
      {label}
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 border border-[#6a5428] bg-[#0c0a08] px-2 text-sm text-[#f0ead8]"
    >
      {options.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}

function pickSlot(item: Item, character: Character): SlotId | null {
  const base = getBase(item.baseId);
  if (base.kind === "ring") {
    if (!character.equipment.ringLeft) return "ringLeft";
    if (!character.equipment.ringRight) return "ringRight";
    return "ringLeft";
  }
  if (base.kind === "weapon") return "mainHand";
  if (base.kind === "shield") return "offHand";
  return defaultSlotForKind(base.kind);
}

function targetLabel(slot: SlotId): string {
  const names: Record<SlotId, string> = {
    helm: "头盔",
    armor: "盔甲",
    belt: "腰带",
    gloves: "手套",
    boots: "靴子",
    amulet: "项链",
    ringLeft: "左戒指",
    ringRight: "右戒指",
    mainHand: "主手",
    offHand: "副手",
  };
  return names[slot];
}
