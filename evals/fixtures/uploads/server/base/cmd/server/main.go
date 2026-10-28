package main

import (
	"log"
	"net/http"

	"example.test/uploads/codec"
	"example.test/uploads/config"
	"example.test/uploads/health"
	"example.test/uploads/store"
	"example.test/uploads/upload"
)

func main() {
	cfg := config.FromEnv()

	encode, err := codec.Get(cfg.Codec)
	if err != nil {
		log.Fatal(err)
	}

	queue := make(chan upload.Job, 64)
	st := newStore(cfg)
	for i := 0; i < cfg.Workers; i++ {
		go upload.Work(queue, st, encode)
	}

	http.Handle("POST /uploads", &upload.Handler{Queue: queue})
	http.HandleFunc("GET /healthz", health.Handler)
	health.SetReady()
	log.Fatal(http.ListenAndServe(cfg.Addr, nil))
}

func newStore(cfg config.Config) store.Store {
	if cfg.Store == "disk" {
		return &store.Disk{Dir: cfg.DataDir}
	}
	return &store.Memory{}
}
