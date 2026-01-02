package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weladee/weladee-form/internal/db/sqlc"
)

type Database struct {
	Queries *sqlc.Queries
	Pool    *pgxpool.Pool
}

func NewDatabase(pool *pgxpool.Pool) *Database {
	return &Database{
		Queries: sqlc.New(pool),
		Pool:    pool,
	}
}

// ExecTx executes a function within a transaction
func (db *Database) ExecTx(ctx context.Context, fn func(*sqlc.Queries) error) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}

	q := db.Queries.WithTx(tx)
	err = fn(q)
	if err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			return err
		}
		return err
	}

	return tx.Commit(ctx)
}
