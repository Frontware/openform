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
	RedisURL    string `mapstructure:"redis_url" yaml:"redis_url"`
	RedisPrefix string `mapstructure:"redis_prefix" yaml:"redis_prefix"`

	// SMTP Configuration
	SMTPHost     string `mapstructure:"smtp_host" yaml:"smtp_host"`
	SMTPPort     string `mapstructure:"smtp_port" yaml:"smtp_port"`
	SMTPUsername string `mapstructure:"smtp_username" yaml:"smtp_username"`
	SMTPPassword string `mapstructure:"smtp_password" yaml:"smtp_password"`
	SMTPFrom     string `mapstructure:"smtp_from" yaml:"smtp_from"`

	// OAuth Configuration
	GoogleClientID     string `mapstructure:"google_client_id" yaml:"google_client_id"`
	GoogleClientSecret string `mapstructure:"google_client_secret" yaml:"google_client_secret"`
	OAuthRedirectURL   string `mapstructure:"oauth_redirect_url" yaml:"oauth_redirect_url"`
	JWTSecret          string `mapstructure:"jwt_secret" yaml:"jwt_secret"`

	// S3 Configuration
	S3Region     string `mapstructure:"s3_region" yaml:"s3_region"`
	S3Bucket     string `mapstructure:"s3_bucket" yaml:"s3_bucket"`
	S3AccessKey  string `mapstructure:"s3_access_key" yaml:"s3_access_key"`
	S3SecretKey  string `mapstructure:"s3_secret_key" yaml:"s3_secret_key"`
	S3Endpoint   string `mapstructure:"s3_endpoint" yaml:"s3_endpoint"`
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
		"grpc_port":            "GRPC_PORT",
		"database_url":         "DATABASE_URL",
		"redis_url":            "REDIS_URL",
		"redis_prefix":         "REDIS_KEY_PREFIX",
		"smtp_host":            "SMTP_HOST",
		"smtp_port":            "SMTP_PORT",
		"smtp_username":        "SMTP_USERNAME",
		"smtp_password":        "SMTP_PASSWORD",
		"smtp_from":            "SMTP_FROM",
		"google_client_id":     "GOOGLE_CLIENT_ID",
		"google_client_secret": "GOOGLE_CLIENT_SECRET",
		"oauth_redirect_url":   "OAUTH_REDIRECT_URL",
		"jwt_secret":           "JWT_SECRET",
		"s3_region":            "S3_REGION",
		"s3_bucket":            "S3_BUCKET",
		"s3_access_key":        "S3_ACCESS_KEY",
		"s3_secret_key":        "S3_SECRET_KEY",
		"s3_endpoint":          "S3_ENDPOINT",
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
			"grpc-port", "database-url", "redis-url", "redis-prefix",
			"smtp-host", "smtp-port", "smtp-username", "smtp-password", "smtp-from",
			"google-client-id", "google-client-secret", "oauth-redirect-url", "jwt-secret",
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
		"redis_url":    "redis://localhost:6379",
		"redis_prefix": "weladee:auth:token",
		"smtp_port":    "587",
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
		{"redis-url", "r", "redis://localhost:6379", "Redis server URL"},
		{"redis-prefix", "", "weladee:auth:token", "Redis key prefix"},
		{"smtp-host", "", "", "SMTP server host"},
		{"smtp-port", "", "587", "SMTP server port"},
		{"smtp-username", "", "", "SMTP server username"},
		{"smtp-password", "", "", "SMTP server password"},
		{"smtp-from", "", "", "SMTP from email address"},
		{"google-client-id", "", "", "Google OAuth client ID"},
		{"google-client-secret", "", "", "Google OAuth client secret"},
		{"oauth-redirect-url", "", "", "OAuth redirect URL"},
		{"jwt-secret", "", "", "JWT secret key"},
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
