# CLAUDE.md — контекст проекта для Claude Code / FCC

Репозиторий инженерных калькуляторов электроснабжения (GitHub Pages:
https://pafnusha.github.io/ntd-neftegaz-electro/).

## Модули
- `loads.html` — «Расчёт нагрузок 1.x» (страница-бутстрап, контент в чанках
  `loads.html.gz.b64.0/1/2` = gzip+base64). Логика: `loads-app.js`,
  `loads-model-ui.js`, листы — `loads-draw.js` (чанки `loads-draw.gz.b64.0/1`),
  примитивы листа/шрифт DXF — `loads-gost.js`, NED-кабели и PDF — `loads-ned.js`,
  ядро расчётов — `loads-core/` (RTM/модель сети, тесты: `cd loads-core && node tests/run-tests.js`).
- `nagruzki2.html` + `nagruzki2.js` — «Нагрузки 2.0»: двухпоточный РТМ, greedy-фазы,
  ΔU/КЗ, ОЛС шаблонов А/Б, экспорты Excel/Word (.doc HTML) / PDF (А1).
- `ibp.html` (+ ibp-*.js) — расчёт ИБП/АКБ по ГОСТ Р МЭК 60896-21.

## Правила правок (обязательно)
1. После правки `loads-draw.js` — перегенерировать его чанки; правки страницы
   `loads.html` — чанки `loads.html.gz.b64.*` (base64(gzip), 3 куска).
   `loads-app.js`/`loads-model-ui.js`/`loads-gost.js`/`loads-ned.js`/`nagruzki2.*` — обычные файлы,
   но **поднимать `?v=N`** в HTML при каждом изменении (кэш Pages).
2. Листы: только ГОСТ-размеры шрифта (ряд 2,5/3,5/5/7 мм на бумаге А1), штамп
   ГОСТ 2.1105 (`sheetFrame`). Контроль наложений текста bbox-пробой
   (см. test-скрипты playwright) — обязан быть 0.
3. Никаких упоминаний конкретных заказчиков/объектов в коде и листах (обезличено).
4. Тесты перед коммитом: `node tests` в `loads-core`, playwright-проверки модулей.
5. GitHub Pages деплоится сам из `main`; коммиты точечные, без скриншотов/артефактов
   (`.gitignore` — `shots/`, `n2_*.png`).
