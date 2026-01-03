package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// Database connection
	dbURL := "postgres://postgres:fwadmfwadm@192.168.1.62:5432/weladee?sslmode=disable&search_path=form"

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to database
	dbPool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Check if slug column exists
	var exists bool
	err = dbPool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'form' AND table_name = 'forms' AND column_name = 'slug'
		)
	`).Scan(&exists)
	if err != nil {
		log.Fatalf("Failed to check column: %v", err)
	}

	if exists {
		fmt.Println("✓ slug column already exists")
		return
	}

	// Add slug column
	_, err = dbPool.Exec(ctx, `ALTER TABLE form.forms ADD COLUMN slug VARCHAR(255) UNIQUE`)
	if err != nil {
		log.Fatalf("Failed to add slug column: %v", err)
	}

	// Create index
	_, err = dbPool.Exec(ctx, `CREATE INDEX idx_forms_slug ON form.forms(slug)`)
	if err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}

	fmt.Println("✓ Migration completed: slug column added to forms table")
}
