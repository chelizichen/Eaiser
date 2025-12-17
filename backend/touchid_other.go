//go:build !darwin

package backend

// 非 macOS 平台直接跳过生物认证
func requireBiometricAuth(reason string) error {
	return nil
}
