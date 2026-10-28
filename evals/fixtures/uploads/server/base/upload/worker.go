package upload

import (
	"context"
	"log"
	"time"

	"example.test/uploads/codec"
	"example.test/uploads/store"
)

const storeTimeout = 30 * time.Second

// Work stores jobs from queue until it is closed.
func Work(queue <-chan Job, st store.Store, encode codec.Encoder) {
	for job := range queue {
		if err := storeJob(job, st, encode); err != nil {
			log.Printf("upload %s (%s) failed: %v", job.ID, job.Name, err)
			continue
		}
		log.Printf("upload %s stored", job.ID)
	}
}

func storeJob(job Job, st store.Store, encode codec.Encoder) error {
	data, err := encode(job.Data)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	return st.Put(ctx, job.ID, data)
}
