//go:build darwin

package backend

import (
	"errors"

	"github.com/lox/go-touchid"
)

// requireBiometricAuth 请求 macOS Touch ID 认证。
// 调用方负责根据返回的 error 决定是否继续启动。
func requireBiometricAuth(reason string) error {
	ok, err := touchid.Authenticate(reason)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("touch ID 验证失败")
	}
	return nil
}
