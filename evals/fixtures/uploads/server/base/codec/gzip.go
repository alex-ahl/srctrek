package codec

import (
	"bytes"
	"compress/gzip"
)

func init() {
	Register("gzip", encodeGzip)
}

func encodeGzip(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	writer := gzip.NewWriter(&buf)
	if _, err := writer.Write(data); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
