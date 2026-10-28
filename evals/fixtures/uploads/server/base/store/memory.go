package store

import (
	"context"
	"sync"
)

// Memory keeps uploads in a map; for local runs and tests.
type Memory struct {
	mu    sync.Mutex
	files map[string][]byte
}

func (m *Memory) Put(_ context.Context, key string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.files == nil {
		m.files = map[string][]byte{}
	}
	m.files[key] = data
	return nil
}
