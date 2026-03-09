# Job Tracker (Express + Vanilla JS)

A tiny web app to view jobs from your Postgres `public."Jobs_List"` table, mark roles as applied, add notes, filter/search, and export CSV.

## Features
- List jobs with company, link, applied state, applied date, and notes
- One-click toggle for "applied"; bulk mark selected rows
- Search and "only show not applied" filter
- Copy link + open in new tab
- Notes with debounced autosave
- CSV export that respects current filters

## Setup
1. Create env file

```bash
cd job-tracker
cp .env.example .env
# Edit .env and set PGPASSWORD
```

2. Install deps and run

```bash
npm install
npm run dev
```

3. Visit http://localhost:3000

The server will automatically ensure the following columns exist on `public."Jobs_List"`:
- `applied boolean not null default false`
- `applied_at timestamptz`
- `notes text default ''`

Alternatively, you can run the SQL in `sql/init.sql` yourself.

## Notes
- The app uses a pooled connection with `pg` and enables SSL if `PGSSLMODE` is set.
- All updates are parameterized SQL.
- If you don't want to alter your table, you could fork this to keep status in localStorage (not cross-device) or a side table.
