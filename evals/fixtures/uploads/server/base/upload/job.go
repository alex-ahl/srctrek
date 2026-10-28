package upload

// Job is one upload waiting for a worker.
type Job struct {
	ID   string
	Name string
	Data []byte
}
