// Package config reads the server's settings from the environment.
package config

import "os"

type Config struct {
	Addr    string
	Store   string // "disk" or "memory"
	DataDir string
	Codec   string // a name registered in package codec
	Workers int
}

func FromEnv() Config {
	return Config{
		Addr:    getenv("ADDR", ":8080"),
		Store:   getenv("STORE", "memory"),
		DataDir: getenv("DATA_DIR", "/var/lib/uploads"),
		Codec:   getenv("CODEC", "gzip"),
		Workers: 4,
	}
}

func getenv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
