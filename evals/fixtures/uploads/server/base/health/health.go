// Package health answers load balancer checks.
package health

import (
	"net/http"
	"sync/atomic"
)

var ready atomic.Bool

func SetReady() { ready.Store(true) }

func Handler(w http.ResponseWriter, _ *http.Request) {
	if !ready.Load() {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
}
