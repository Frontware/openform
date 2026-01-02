# Weladee Form

A beautiful, open-source TypeForm alternative. Create engaging forms with a one-question-at-a-time experience.

![Weladee Form Logo](logo.png)

## Features

- **7 beautiful themes** - Midnight, Ocean, Sunset, Forest, Lavender, Weladee, Minimal
- **Keyboard navigation** - Navigate with Enter, arrow keys, and scroll wheel
- **Mobile-first forms** - Responsive form-taking experience
- **Secure authentication** - Google OAuth and Magic Link
- **Response dashboard** - View, search, filter, and export to CSV
- **13 question types** - Text, multiple choice, rating, file upload, and more
- **Internationalization** - Support for English and Thai

## Question types

| Type | Description |
|------|-------------|
| Short text | Single line text input |
| Long text | Multi-line textarea |
| Dropdown | Select one option |
| Checkboxes | Select multiple options |
| Email | Email with validation |
| Phone | Phone number input |
| Number | Numeric input |
| Date | Date picker |
| Rating | Star rating (1-5) |
| Opinion scale | Numeric scale (1-10) |
| Yes/No | Binary choice |
| File upload | Images and PDFs |
| Website URL | URL with validation |

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **Backend**: Go (gRPC)
- **Database**: PostgreSQL
- **Auth**: Google OAuth + Magic Link
- **i18n**: next-intl
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Animations**: Framer Motion
- **File storage**: S3 (MinIO / AWS)

## Getting started

### Prerequisites

- Node.js 18+
- Go 1.22+
- PostgreSQL
- S3-compatible storage (e.g., MinIO, AWS S3)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/weladee-form.git
cd weladee-form
```

### 2. Set up Database

1. Create a PostgreSQL database.
2. Run the schema migration:
   ```bash
   psql -d your_database -f sql/schema/form_schema.sql
   ```

### 3. Configure Environment

Configure your environment variables for Database, S3, and Auth.

### 4. Run the application

**Backend:**
```bash
go run cmd/server/main.go
```

**Frontend:**
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## Project structure

```
weladee-form/
├── app/
│   ├── (main)/           # Main application routes (localized)
│   ├── (form-player)/    # Public form player routes
│   └── api/              # API routes
├── cmd/                  # Go application entrypoints
├── internal/             # Private application code
├── sql/                  # SQL queries and schemas
├── proto/                # gRPC protocol buffers
├── components/           # React components
├── lib/                  # Shared libraries
├── i18n/                 # Internationalization config
└── messages/             # Translation files
```

## License

MIT License - feel free to use this for any project.

## Contributing

Contributions are welcome. Please open an issue or pull request.
