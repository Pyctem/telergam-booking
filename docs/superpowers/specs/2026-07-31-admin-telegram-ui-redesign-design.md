# Редизайн админ-панели на @telegram-apps/telegram-ui — дизайн

Дата: 2026-07-31
Статус: черновик, ожидает ревью пользователя

## 1. Контекст и рамки

План `2026-07-30-telegram-ui-redesign.md` перевёл 4 клиентских экрана на `@telegram-apps/telegram-ui`, явно исключив из скоупа админ-панель (`AdminLayout`, `AdminBookings`, `AdminServices`) — она осталась на голой HTML-разметке (`<table>`, `<input>`, `<button>`, `<ul>`, инлайн-переключатель вкладок через `<button onClick>`). Задача этого захода — закрыть этот пробел тем же способом: заменить разметку на компоненты `telegram-ui`, не трогая бизнес-логику, хуки (`useBusinessSettings`) и API-слой (`../../api/admin`, `../../api/user`).

**В рамках этого захода:** `AdminLayout.tsx`, `AdminBookings.tsx`, `AdminServices.tsx`.

**Вне рамок:** любые новые admin-возможности (редактирование услуги, пагинация брони, фильтры) — не запрашивались, не добавляются.

## 2. Экраны

### 2.1 Переключатель вкладок (`AdminLayout.tsx`)

- `<nav><button>...</button></nav>` заменяется на `Tabbar`/`Tabbar.Item` (`selected`, `text`, `onClick`) — два таба: "Today's Bookings", "Services".
- `Tabbar` рендерится через внутренний `FixedLayout` с `position: fixed` (подтверждено чтением скомпилированного CSS пакета: `.tgui-53cb2ebed0c3b08f{...}` использует класс с `position:fixed` через `FixedLayout`). Используется `vertical="top"`, поэтому контентная обёртка под табами получает `padding-top`, компенсирующий высоту бара (замерить фактическую высоту при вёрстке — не хардкодить магическое число без проверки на реальном рендере).
- `<p>Loading...</p>` (и до, и после проверки `me?.role`) заменяется на `Placeholder header="Loading..."` + `Spinner size="m"`, как в остальных экранах. Логика `isPending`/редиректа не меняется.

### 2.2 Список брони (`AdminBookings.tsx`)

- `<table>` с колонками Time/Client/Service заменяется на `List` → `Section header="Today's Bookings"` → `Cell` на каждую бронь: `Cell.subtitle` = время (`HH:mm`), тело `Cell` = `{clientFirstName ?? clientUsername ?? '—'} · {serviceName}` — по аналогии с тем, как `MyBookings.tsx` комбинирует поля вокруг `Cell`.
- Пустой список на выбранную дату — `Placeholder description="No bookings for this date"` внутри `Section` (не отдельный экран — дата остаётся выбираемой).
- Выбор даты остаётся нативным `<input type="date">` — горизонт бронирования тут не действует (админ должен видеть любую дату, прошлую или будущую), поэтому калёндарные `Chip`, использованные в `SelectSlot`, не подходят. `<input>` оборачивается в `Section`/`Cell` вместо голого элемента на странице.
- `Placeholder`+`Spinner` вместо `<p>Loading...</p>` на старте (пока `settings`/`date` не готовы).

### 2.3 Услуги (`AdminServices.tsx`)

- Список услуг: `<ul><li>` → `List` → `Section header="Services"` → `Cell` на услугу: тело = название, `Cell.subtitle` = `{price} ₽ · {durationMinutes} min`, `Cell.after` = `Button size="s" mode="outline"` ("Delete", только для `isActive`) — тот же паттерн, что и Cancel-кнопка в `MyBookings.tsx`.
- Форма добавления: три `<label>+<input>` пары заменяются на `Input` из `telegram-ui` с проп `header` (рендерит `<label>`-обёртку вокруг `<input>` — подтверждено по `.d.ts`: `FormInputProps extends HTMLAttributes<HTMLLabelElement>`), что сохраняет доступность через implicit label association — `getByLabelText(/name/i)` и т.п. в тестах продолжат работать без смены стратегии запроса.
- Кнопка "Add" — `Button mode="filled" stretched type="submit"`.

## 3. Тестирование

- `AdminLayout.test.tsx`: три существующих теста (redirect для не-админа, рендер табов для админа, isPending-регресс) сохраняют поведенческое покрытие — правятся только селекторы (`getByText("Today's Bookings")` остаётся, но `getByRole('button', { name: 'Services' })` может потребовать поправки под `Tabbar.Item`'s фактический DOM-узел — проверить при вёрстке, не гадать).
- `AdminServices.test.tsx`: один существующий тест (список + создание через форму) — селекторы `getByLabelText`/`getByRole('button', { name: /add/i })` должны остаться рабочими благодаря `Input`'s `header`-в-label паттерну; если `Input` рендерит `<label>` не так, как предполагается, — поправить селекторы по факту рендера, не по предположению.
- `AdminBookings.test.tsx` — **не существует сейчас** (пробел в покрытии, не связанный с этим редизайном, но раз файл всё равно переписывается — добавляется новый тест-файл по образцу `MyBookings.test.tsx`/`ServicesList.test.tsx`: рендер списка брони на дату (мок `getAdminBookings`), пустое состояние (`Placeholder`), смена даты через `<input>` перезапрашивает `getAdminBookings` с новой датой.

## 4. Зависимости

Новых зависимостей не требуется — используются уже установленные `@telegram-apps/telegram-ui` (`Tabbar`, `List`, `Section`, `Cell`, `Placeholder`, `Spinner`, `Input`, `Button`), версия не меняется.
