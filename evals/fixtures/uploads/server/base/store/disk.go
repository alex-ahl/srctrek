package store

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// Disk writes each upload to a file in Dir.
type Disk struct {
	Dir string
}

func (d *Disk) Put(ctx context.Context, key string, data []byte) error {
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("put %s: %w", key, err)
	}
	return os.WriteFile(filepath.Join(d.Dir, key), data, 0o644)
}
