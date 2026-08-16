import fs from 'fs';
import path from 'path';

const dict = {
  "uk-UA": "en-US",
  "Позначено як": "Marked as",
  "Змінено статус": "Status changed",
  "Оцінив": "Rated",
  "Переглянув S": "Watched S",
  "Переглянув епізод": "Watched episode",
  "Прочитав розд.": "Read ch.",
  "Прочитав розділ": "Read chapter",
  "Прочитав до сторінки": "Read to page",
  "Прочитав випуск #": "Read issue #",
  "Награно годин:": "Hours played:",
  "Розпочав повторне проходження/перегляд #": "Started replay/rewatch #",
  "Оновив замітку": "Updated note",
  "Імпортовано": "Imported",
  "записів з MyAnimeList": "records from MyAnimeList",
  "Щойно": "Just now",
  "хв. тому": "mins ago",
  "год. тому": "hrs ago",
  "Вчора": "Yesterday",
  "дн. тому": "days ago",
  "Активність у": "Activity in",
  "дій": "actions",
  "Менше": "Less",
  "Більше": "More",
  "Додати в добірку": "Add to collection",
  "Скасувати": "Cancel",
  "Головна": "Home",
  "Каталог": "Catalog",
  "Стрічка": "Feed",
  "Профіль": "Profile",
  "Добірки": "Collections",
  "Трекінг": "Tracking",
  "Рецензії": "Reviews",
  "Модерація": "Moderation",
  "Адмін": "Admin",
  "Підписки": "Following",
  "Авторизація": "Authorization",
  "Вхід": "Login",
  "Реєстрація": "Register",
  "Медіа": "Media",
  "Налаштування": "Settings",
  "Історія проходжень": "Playthrough history",
  "Ще немає записів про проходження.": "No playthrough records yet.",
  "Початок": "Start",
  "Завершення": "End",
  "Проходження": "Playthrough",
  "Перегляд (Фільми, Серіали, Аніме)": "Watch (Films, TV Series, Anime)",
  "Перегляд": "Rewatch",
  "Прочитання": "Reread",
  "Наш": "Ours",
  "Зовнішніх рейтингів немає": "No external ratings",
  "Цілі на": "Goals for",
  "рік": "year",
  "Налаштувати": "Configure",
  "Ігри": "Games",
  "Читання (Книги, Манга, Комікси)": "Read (Books, Manga, Comics)",
  "Завантажити ще": "Load more",
  "Завантаження…": "Loading...",
  "Помилка імпорту файлу": "File import error",
  "Імпорт з MAL": "Import from MAL",
  "Імпорт з MyAnimeList": "Import from MyAnimeList",
  "Експортуйте свій список аніме з MyAnimeList (у форматі XML) та завантажте його сюди, щоб перенести ваші збереження.": "Export your anime list from MyAnimeList (in XML format) and upload it here to import your tracking data.",
  "Імпортуємо записи... Це може зайняти хвилину.": "Importing records... This might take a minute.",
  "Успішно імпортовано:": "Successfully imported:",
  "Не вдалося імпортувати:": "Failed to import:",
  "Сторінка зараз оновиться...": "Page will refresh now...",
  "Оберіть XML файл": "Select XML file",
  "тільки MAL Anime List (.xml)": "only MAL Anime List (.xml)",
  "Ваша оцінка": "Your score",
  "Ваша замітка": "Your note",
  "Розподіл медіа": "Media distribution",
  "Немає даних": "No data",
  "Всього": "Total",
  "Обрати": "Select",
  "Очистити": "Clear",
  "Немає опцій": "No options",
  "Сховати пароль": "Hide password",
  "Показати пароль": "Show password",
  "Прогрес": "Progress",
  "Фільми не мають лічильника прогресу. Оновіть статус на \"Переглянуто\".": "Films don't have a progress counter. Update status to \"Completed\".",
  "Сезон": "Season",
  "Епізод": "Episode",
  "Том": "Volume",
  "Розділ": "Chapter",
  "Випуск": "Issue",
  "Сторінка": "Page",
  "Годин зіграно": "Hours played",
  "Рівень завершення": "Completion tier",
  "Основний сюжет": "Main story",
  "Сюжет + Доп. квести": "Story + Extras",
  "100% (Комплеціоніст)": "100% (Completionist)",
  "— Оберіть —": "— Select —",
  "Пошук:": "Search:",
  "Нічого не знайдено": "Nothing found",
  "Пошук...": "Search...",
  "Усі": "All",
  "Шукаємо...": "Searching...",
  "Останні пошуки": "Recent searches",
  "Введіть назву для пошуку": "Type a title to search",
  "Рейтинг": "Rating",
  "Оцінка": "Score",
  "Додати": "Add",
  "Видалити зі списку": "Remove from list",
  "Сюжет+Доп": "Story+Extras",
  "Сюжет": "Story",
  "Українська": "Ukrainian",
  "Помилка сервера": "Server error",
  "Помилка": "Error",
  "Сталося щось": "Something happened",
  "Без назви": "Untitled",
  "Це поле є обов'язковим": "This field is required",
  "Невірний формат email": "Invalid email format",
  "Мінімальна довжина:": "Minimum length:",
  "символів": "characters",
  "Закоротко": "Too short",
  "Паролі не співпадають": "Passwords do not match",
  "Упс! Сталася помилка": "Oops! An error occurred",
  "Щось пішло не так.": "Something went wrong.",
  "Повернутися на головну": "Return to home page",
  "Стрічка активності": "Activity feed",
  "Ласкаво просимо до Traxy!": "Welcome to Traxy!",
  "Ваша стрічка порожня. Почніть додавати фільми, серіали чи ігри до свого списку.": "Your feed is empty. Start adding films, series, or games to your list.",
  "Шукати": "Search",
  "Мої добірки": "My Collections",
  "Нова добірка": "New collection",
  "Добірка:": "Collection:",
  "Добірки завантажуються...": "Loading collections...",
  "Медіа не знайдено": "Media not found",
  "Пошук": "Search",
  "Експортуємо...": "Exporting...",
  "Експорт успішний!": "Export successful!",
  "Помилка експорту": "Export error",
  "Увага: це видалить всі поточні дані та замінить їх даними з бекапу. Продовжити?": "Warning: this will delete all current data and replace it with data from the backup. Continue?",
  "Імпортуємо...": "Importing...",
  "Імпорт успішний! Оновлюємо сторінку...": "Import successful! Refreshing page...",
  "Помилка імпорту. Перевірте файл.": "Import error. Check the file.",
  "Встановіть скільки тайтлів ви хочете завершити у цьому році.": "Set how many titles you want to complete this year.",
  "Зберегти цілі": "Save goals",
  "Збережено!": "Saved!",
  "Резервне копіювання": "Backup",
  "Оскільки всі дані зберігаються локально на вашому пристрої, ми рекомендуємо періодично робити бекап.": "Since all data is stored locally on your device, we recommend taking a backup periodically.",
  "Експортувати дані": "Export data",
  "Відновити з бекапу": "Restore from backup",
  "Статистика": "Statistics",
  "Всього у списку": "Total in list",
  "Завершено": "Completed",
  "Середня оцінка": "Average score",
  "У процесі": "In Progress",
  "У планах": "Planned",
  "Призупинено": "Paused",
  "Кинуто": "Dropped",
  "Мій список": "My List",
  "Останні оновлені": "Recently updated",
  "Найвища оцінка": "Highest score",
  "За назвою (А-Я)": "By title (A-Z)",
  "Всі типи": "All types",
  "Тут поки нічого немає.": "Nothing here yet.",
  "т.": "vol."
};

const dir = 'd:/projects/Traxy/frontend/src';
const cyrillicRegex = /[\u0400-\u04FF]+/;

// Sort dictionary by length descending to replace longer phrases first
const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

let modifiedFiles = 0;

function walkSync(currentDirPath) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile() && !filePath.endsWith('.png') && !filePath.endsWith('.wasm')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let originalContent = content;
            
            // Only process if there's cyrillic or uk-UA
            if (cyrillicRegex.test(content) || content.includes('uk-UA')) {
                for (let key of sortedKeys) {
                    // Create global regex for the string
                    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
                    const regex = new RegExp(escapeRegExp(key), 'g');
                    content = content.replace(regex, dict[key]);
                }
                
                if (content !== originalContent) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    modifiedFiles++;
                    console.log('Updated', filePath);
                }
            }
        } else if (stat.isDirectory()) {
            walkSync(filePath);
        }
    });
}
walkSync(dir);
console.log('Modified ' + modifiedFiles + ' files.');
