Fix Windows drop / GitHub push (read me first)
==============================================

Problem:
- Old 投放.cmd uses Chinese text. Windows cmd reads it as GBK -> broken commands
  ('plorer', garb echo, etc.)
- Old scripts/drop.mjs on GitHub does NOT understand drop\bg\1\
  so loop.png never enters inbox and never git push

Install (on G:\guajiyouxi\guajiyouxi):
1. Close the black watch window.
2. Unzip this archive INTO the project root (merge/overwrite).
   Needed paths after unzip:
     drop.cmd
     投放.cmd          (same ASCII content as drop.cmd)
     fix-drop.cmd
     open-bg.cmd
     push-bg.cmd
     scripts\drop.mjs
     scripts\prepare-drop.mjs
     src\lib\sprites\drop.mjs
3. Double-click drop.cmd  (preferred)  OR  fix-drop.cmd
4. Explorer should open drop\bg\1\
5. Put loop.png there (3840x720 PNG)
6. Black window should print:
     bg/1/loop.png -> public/sprites/inbox/backgrounds/chapter-1/loop.png
     已推到仓库...
7. Tell the agent: 图放好了

If watch still ignores bg, run push-bg.cmd once (force copy+commit+push).

Do NOT use the old Chinese-only 投放.cmd from GitHub until you overwrite it.
