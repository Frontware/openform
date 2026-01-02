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
	JWTSecret   string `mapstructure:"jwt_secret" yaml:"jwt_secret"`

	// S3 Configuration
	S3Region    string `mapstructure:"s3_region" yaml:"s3_region"`
	S3Bucket    string `mapstructure:"s3_bucket" yaml:"s3_bucket"`
	S3AccessKey string `mapstructure:"s3_access_key" yaml:"s3_access_key"`
	S3SecretKey string `mapstructure:"s3_secret_key" yaml:"s3_secret_key"`
	S3Endpoint  string `mapstructure:"s3_endpoint" yaml:"s3_endpoint"`
}

// LoadConfig loads configuration from config file, environment variables, and command line flags
// Priority order: CLI flags > Environment variables > Config file
func LoadConfig(cmd *cobra.Command) (*Config, error) {
	// Set up Viper
	v := viper.New()

	// Set config file name and paths
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	// Enable reading from environment variables
	v.SetEnvPrefix("OPENFORM")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Bind environment variables
	envBindings := map[string]string{
		"grpc_port":     "GRPC_PORT",
		"database_url":  "DATABASE_URL",
		"jwt_secret":    "JWT_SECRET",
		"s3_region":     "S3_REGION",
		"s3_bucket":     "S3_BUCKET",
		"s3_access_key": "S3_ACCESS_KEY",
		"s3_secret_key": "S3_SECRET_KEY",
		"s3_endpoint":   "S3_ENDPOINT",
	}

	for configKey, envVar := range envBindings {
		if err := v.BindEnv(configKey, envVar); err != nil {
			return nil, fmt.Errorf("failed to bind environment variable %s: %w", envVar, err)
		}
	}

	// Read config file (ignore error if file doesn't exist)
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	// Bind command line flags (highest priority)
	if cmd != nil {
		flags := []string{
			"grpc-port", "database-url", "jwt-secret",
			"s3-region", "s3-bucket", "s3-access-key", "s3-secret-key", "s3-endpoint",
		}
		for _, flag := range flags {
			if err := v.BindPFlag(flag, cmd.Flags().Lookup(flag)); err != nil {
				return nil, fmt.Errorf("failed to bind flag %s: %w", flag, err)
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
		"grpc_port":    "50051",
		"jwt_secret":   "weladee-form-secret-change-in-production",
		"s3_region":    "auto",
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
		{"grpc-port", "p", "50051", "gRPC server port"},
		{"database-url", "d", "", "PostgreSQL database URL (required)"},
		{"jwt-secret", "", "", "JWT secret key (default: weladee-form-secret-change-in-production)"},
		{"s3-region", "", "auto", "S3 region"},
		{"s3-bucket", "", "", "S3 bucket name"},
		{"s3-access-key", "", "", "S3 access key"},
		{"s3-secret-key", "", "", "S3 secret key"},
		{"s3-endpoint", "", "", "S3 endpoint URL"},
	}

	for _, flag := range flags {
		if flag.short != "" {
			cmd.Flags().StringP(flag.name, flag.short, flag.defaultValue, flag.description)
		} else {
			cmd.Flags().String(flag.name, flag.defaultValue, flag.description)
		}
	}
}
