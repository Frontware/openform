package config

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	GRPCPort    string `mapstructure:"grpc_port" yaml:"grpc_port"`
	DatabaseURL string `mapstructure:"database_url" yaml:"database_url"`
	JWTSecret          string `mapstructure:"jwt_secret" yaml:"jwt_secret"`
	JWTPrivateKeyPath  string `mapstructure:"jwt_private_key_path" yaml:"jwt_private_key_path"`
	JWTPublicKeyPath   string `mapstructure:"jwt_public_key_path" yaml:"jwt_public_key_path"`

	// S3 Configuration
	S3Region    string `mapstructure:"s3_region" yaml:"s3_region"`
	S3Bucket    string `mapstructure:"s3_bucket" yaml:"s3_bucket"`
	S3AccessKey string `mapstructure:"s3_access_key" yaml:"s3_access_key"`
	S3SecretKey string `mapstructure:"s3_secret_key" yaml:"s3_secret_key"`
	S3Endpoint  string `mapstructure:"s3_endpoint" yaml:"s3_endpoint"`

	// reCAPTCHA Configuration
	Recaptcha RecaptchaConfig `mapstructure:"recaptcha" yaml:"recaptcha"`
}

// RecaptchaConfig holds reCAPTCHA configuration
type RecaptchaConfig struct {
	Enabled   bool    `mapstructure:"enabled" yaml:"enabled"`
	SiteKey   string  `mapstructure:"site_key" yaml:"site_key"`
	SecretKey string  `mapstructure:"secret_key" yaml:"secret_key"`
	Threshold float64 `mapstructure:"threshold" yaml:"threshold"`
}

// LoadConfig loads configuration from config file, environment variables, and command line flags
// Priority order: CLI flags > Environment variables > Config file
func LoadConfig(cmd *cobra.Command) (*Config, error) {
	// Set up Viper
	v := viper.New()

	// Handle config file
	cfgFile := ""
	if cmd != nil {
		cfgFile, _ = cmd.Flags().GetString("config")
	}

	if cfgFile != "" {
		v.SetConfigFile(cfgFile)
	} else {
		// Set config file name and paths
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(".")
		v.AddConfigPath("./config")
	}

	// Enable reading from environment variables
	v.SetEnvPrefix("WeladeeForm")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Bind environment variables
	envBindings := map[string]string{
		"grpc_port":            "GRPC_PORT",
		"database_url":         "DATABASE_URL",
		"jwt_secret":           "JWT_SECRET",
		"jwt_private_key_path": "JWT_PRIVATE_KEY_PATH",
		"jwt_public_key_path":  "JWT_PUBLIC_KEY_PATH",
		"s3_region":            "S3_REGION",
		"s3_bucket":            "S3_BUCKET",
		"s3_access_key":        "S3_ACCESS_KEY",
		"s3_secret_key":        "S3_SECRET_KEY",
		"s3_endpoint":          "S3_ENDPOINT",
		"recaptcha.enabled":    "RECAPTCHA_ENABLED",
		"recaptcha.site_key":   "RECAPTCHA_SITE_KEY",
		"recaptcha.secret_key": "RECAPTCHA_SECRET_KEY",
		"recaptcha.threshold":  "RECAPTCHA_THRESHOLD",
	}

	for configKey, envVar := range envBindings {
		if err := v.BindEnv(configKey, envVar); err != nil {
			return nil, fmt.Errorf("failed to bind environment variable %s: %w", envVar, err)
		}
	}

	// Read config file (ignore error if file doesn't exist)
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// If config file was explicitly specified but not found, return error
			if cfgFile != "" {
				return nil, fmt.Errorf("failed to read config file: %w", err)
			}
			// Otherwise continue (might get config from env or flags)
		}
	}

	// Bind command line flags (highest priority)
	if cmd != nil {
		// Map flag names to Viper configuration keys (matching mapstructure tags)
		flagBindings := map[string]string{
			"grpc-port":            "grpc_port",
			"database-url":         "database_url",
			"jwt-secret":           "jwt_secret",
			"jwt-private-key-path": "jwt_private_key_path",
			"jwt-public_key-path":  "jwt_public_key_path",
			"s3-region":            "s3_region",
			"s3-bucket":            "s3_bucket",
			"s3-access-key":        "s3_access_key",
			"s3-secret-key":        "s3_secret_key",
			"s3-endpoint":          "s3_endpoint",
			"recaptcha-enabled":    "recaptcha.enabled",
			"recaptcha-site-key":   "recaptcha.site_key",
			"recaptcha-secret-key": "recaptcha.secret_key",
			"recaptcha-threshold":  "recaptcha.threshold",
		}

		for flagName, configKey := range flagBindings {
			if f := cmd.Flags().Lookup(flagName); f != nil {
				if err := v.BindPFlag(configKey, f); err != nil {
					return nil, fmt.Errorf("failed to bind flag %s: %w", flagName, err)
				}
			}
		}
	}

	// Set default values
	setDefaults(v)

	// Unmarshal into config struct
	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate required configuration
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

// setDefaults sets default values for configuration
func setDefaults(v *viper.Viper) {
	defaults := map[string]interface{}{
		"grpc_port":           "50051",
		"jwt_secret":          "weladee-form-secret-change-in-production",
		"s3_region":           "auto",
		"recaptcha.enabled":   false,
		"recaptcha.threshold": 0.5,
	}

	for key, value := range defaults {
		v.SetDefault(key, value)
	}
}

// validateConfig validates required configuration values
func validateConfig(config *Config) error {
	if config.DatabaseURL == "" {
		return fmt.Errorf("database_url is required")
	}

	// Validate reCAPTCHA configuration if enabled
	if config.Recaptcha.Enabled {
		if config.Recaptcha.SiteKey == "" {
			return fmt.Errorf("recaptcha.site_key is required when recaptcha.enabled is true")
		}
		if config.Recaptcha.SecretKey == "" {
			return fmt.Errorf("recaptcha.secret_key is required when recaptcha.enabled is true")
		}
		if config.Recaptcha.Threshold <= 0 || config.Recaptcha.Threshold > 1 {
			return fmt.Errorf("recaptcha.threshold must be between 0 and 1")
		}
	}

	return nil
}

// AddFlags adds command line flags to the cobra command
func AddFlags(cmd *cobra.Command) {
	flags := []struct {
		name         string
		short        string
		defaultValue string
		description  string
	}{
		{"config", "c", "", "config file (default is ./config.yaml)"},
		{"grpc-port", "p", "50051", "gRPC server port"},
		{"database-url", "d", "", "PostgreSQL database URL (required)"},
		{"jwt-secret", "", "", "JWT secret key (default: weladee-form-secret-change-in-production)"},
		{"jwt-private-key-path", "", "", "Path to JWT private key (for RS256 signing)"},
		{"jwt-public-key-path", "", "", "Path to JWT public key (for RS256 validation)"},
		{"s3-region", "", "auto", "S3 region"},
		{"s3-bucket", "", "", "S3 bucket name"},
		{"s3-access-key", "", "", "S3 access key"},
		{"s3-secret-key", "", "", "S3 secret key"},
		{"s3-endpoint", "", "", "S3 endpoint URL"},
		{"recaptcha-enabled", "", "false", "Enable reCAPTCHA protection"},
		{"recaptcha-site-key", "", "", "reCAPTCHA site key"},
		{"recaptcha-secret-key", "", "", "reCAPTCHA secret key"},
		{"recaptcha-threshold", "", "0.5", "reCAPTCHA score threshold (0.0-1.0)"},
	}

	for _, flag := range flags {
		if flag.short != "" {
			cmd.Flags().StringP(flag.name, flag.short, flag.defaultValue, flag.description)
		} else {
			cmd.Flags().String(flag.name, flag.defaultValue, flag.description)
		}
	}
}