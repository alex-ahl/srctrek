package codec

func init() {
	Register("none", func(data []byte) ([]byte, error) { return data, nil })
}
