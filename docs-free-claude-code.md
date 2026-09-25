# Бесплатный Claude Code (FCC) в этом проекте — инструкция

Что это: [free-claude-code (FCC)](https://github.com/Alishahryar1/free-claude-code) —
open-source локальный прокси (AGPL): Claude Code работает бесплатно через API сторонних
провайдеров (NVIDIA NIM, Groq, OpenRouter, Gemini, GitHub Copilot OAuth, локальный Ollama).
Устанавливается ОДИН РАЗ на компьютер — дальше работает во всех проектах.

## 1. Установка
**Windows (PowerShell):**
```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/Alishahryar1/free-claude-code/main/scripts/install.ps1")))
```
**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/Alishahryar1/free-claude-code/main/scripts/install.sh | sh
```
При выборе агентов отметьте Claude Code.

Если загрузчик Claude Code (`claude.ai/install.sh`) отдаёт 403 (региональные ограничения) —
поставьте CLI из npm и перезапустите установщик FCC:
```powershell
npm install -g @anthropic-ai/claude-code   # при отказе папки Program Files:
# 1) npm config set prefix %USERPROFILE%\npm-global   (Windows)
# 2) export PATH="$HOME/.npm-global/bin:$PATH"          (Linux/macOS)
```
Если npm-установка global пишет EACCES — укажите свой prefix (см. выше) или запускайте
PowerShell от администратора.

## 2. Первый запуск и модель
1. Запуск сервера: Windows — ярлык «Free Claude Code»; macOS — из Приложений; Linux — `fcc-server`.
2. Откроется Admin UI в браузере → Providers → вставьте ключ одного из бесплатных провайдеров:
   - NVIDIA NIM: https://build.nvidia.com/settings/api-keys → `NVIDIA_NIM_API_KEY`
   - Groq: https://console.groq.com/keys → `GROQ_API_KEY`
   - Google AI Studio: https://aistudio.google.com/apikey → `GEMINI_API_KEY`
   - есть OAuth-подключение GitHub Copilot (Providers → OAuth, нужен Copilot CLI 1.0.83+ и подписка Copilot).
3. Выберите MODEL из списка → Apply.

## 3. Работа с ЭТИМ репозиторием
```bash
git clone https://github.com/Pafnusha/ntd-neftegaz-electro.git
cd ntd-neftegaz-electro
gh auth login            # один раз — доступ git к GitHub (или ключ SSH)
fcc-claude               # Claude Code через FCC, из папки проекта
```
В первом сообщении агенту укажите: «сначала прочитай CLAUDE.md».
В CLAUDE.md описаны правила: пересборка gzip-чанков после правок `loads-draw.js`,
поднятие `?v=` у скриптов, обязательные тесты и контроль наложений на листах.
Глобально настройки Claude Code лежат в `~/.claude/` и `~/.fcc/` — для остальных
проектов ничего дополнительно ставить не нужно, просто запускайте `fcc-claude` в папке.

## 4. Обновление / удаление
```bash
fcc-update
curl -fsSL https://raw.githubusercontent.com/Alishahryar1/free-claude-code/main/scripts/uninstall.sh | sh
```

## Замечания по безопасности
- Проект не аффилирован с Anthropic; устанавливаете — просмотрите scripts/install.* заранее.
- Ключи провайдеров хранятся локально в Admin UI (~/.fcc); не коммитьте их в git.
- Токен GitHub: используйте fine-grained PAT с доступом только к этому репозиторию,
  не показывайте токены в чатах и не кладите в файлы проекта.
