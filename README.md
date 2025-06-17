# AptekaRU156

Интернет-аптека на Node.js, Express, EJS, Bootstrap, PostgreSQL.

## Быстрый старт

1. Клонируйте репозиторий:
   ```bash
   git clone <repo-url>
   cd aptekaru156
   ```
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Создайте файл `.env` по примеру ниже.
4. Запустите локально:
   ```bash
   npm start
   ```

## Пример .env
```
DATABASE_URL=postgres://user:password@host:port/dbname
SESSION_SECRET=your_secret
CLOUDINARY_URL=cloudinary://key:secret@cloud_name
```

## Деплой на Render.com
- Добавьте переменные окружения из `.env` в настройках Render.
- Укажите команду запуска: `npm start`
- Node.js 18+

## Стек
- Node.js, Express
- EJS
- Bootstrap 5
- PostgreSQL 