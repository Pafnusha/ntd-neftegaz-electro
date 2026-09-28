# eldraw-loads — однолинейка ЕСКД из модуля нагрузок Пафнуши

Мост между калькулятором [ntd-neftegaz-electro](https://github.com/Pafnusha/ntd-neftegaz-electro)
и библиотекой чертежа [eldraw](https://github.com/vaganchik/eldraw).

Ведомость РТМ → УГО ГОСТ 2.755 (QS, QF, QFD, шины, XT) → рамка/штамп ГОСТ 2.104
→ таблица нагрузок РТМ / ПЭ3 ГОСТ 2.702 → **DXF для nanoCAD / AutoCAD / КОМПАС**.

## Установка

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r eldraw-loads/requirements.txt
```

## Запуск

```bash
python3 eldraw-loads/generate_sld.py eldraw-loads/sample-rtm-loads.json \
  -o eldraw-loads/output/pafnusha-sld-eskd
```

На странице `loads.html` кнопка **«ЕСКД eldraw (DXF)»** сохраняет текущую ведомость
как `rtm-loads-eldraw.json`. Этот файл скармливается генератору.

## Что строится

- вводной рубильник QS1 и автомат QF1 по Iр щита;
- сборная шина секции 1, отходящие QF / QFD (особая группа);
- секция 2 + QS2/QF21, если в ведомости есть Nрез;
- таблица нагрузок (Pу, Iр, фаза, аппарат, кабель, L);
- перечень элементов ПЭ3;
- проверка ERC eldraw.

Формат листа: А3 / А2 / А1 — по числу фидеров.
