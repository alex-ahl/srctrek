// Package upload accepts uploads over HTTP and stores them in the background.
package upload

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
)

const maxUpload = 10 << 20

// Handler queues each upload and answers 202 right away; workers store it later.
type Handler struct {
	Queue chan<- Job
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(io.LimitReader(r.Body, maxUpload))
	if err != nil {
		http.Error(w, "can't read upload", http.StatusBadRequest)
		return
	}

	job := Job{ID: newID(), Name: r.URL.Query().Get("name"), Data: data}
	h.Queue <- job

	w.WriteHeader(http.StatusAccepted)
	io.WriteString(w, job.ID)
}

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
