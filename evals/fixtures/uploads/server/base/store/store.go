// Package store keeps uploaded files.
package store

import "context"

type Store interface {
	Put(ctx context.Context, key string, data []byte) error
}
