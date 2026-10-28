// Package codec holds the encodings uploads can be stored in, by name.
package codec

import "fmt"

type Encoder func(data []byte) ([]byte, error)

var encoders = map[string]Encoder{}

// Register makes an encoder available under name; encoders register themselves in init.
func Register(name string, encode Encoder) {
	encoders[name] = encode
}

func Get(name string) (Encoder, error) {
	encode, ok := encoders[name]
	if !ok {
		return nil, fmt.Errorf("no codec %q", name)
	}
	return encode, nil
}
