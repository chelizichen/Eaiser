//go:build darwin

package backend

import (
	"errors"
	"log"

	touchid "github.com/ansxuman/go-touchid"
)

func requireBiometricAuth(reason string) error {
    ok, err := touchid.Auth(touchid.DeviceTypeAny, reason) // Any 允许密码回退
    if err != nil {
        log.Printf("touchid.Auth error: %v\n", err)
        return err
    }
    if !ok {
        return errors.New("生物/密码认证未通过")
    }
    return nil
}