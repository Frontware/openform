# Weladee Form Functionalities by Customer Type

This document outlines the available features and limitations for Weladee Form users based on their customer type.

## Customer Types & Features

| Feature | SME | Standard | Enterprise |
| :--- | :---: | :---: | :---: |
| **Max Forms** | 5 | 15 | Unlimited |
| **Form Creation** | ✅ | ✅ | ✅ |
| **Form Responses** | ✅ | ✅ | ✅ |
| **File Upload Question** | ❌ | ❌ | ✅ |
| **Company Branding** | ❌ | ❌ | ✅ (Logo & Name) |
| **Export to CSV** | ✅ | ✅ | ✅ |
| **Export to Excel** | ❌ | ❌ | ✅ |
| **JWT Generation** | Third-party | Third-party | Third-party |

### Feature Details

#### 1. Form Limits
- **SME**: Users can create up to 5 active forms.
- **Standard**: Users can create up to 15 active forms.
- **Enterprise**: No limit on the number of forms.

#### 2. File Uploads
- Only **Enterprise** users can add "File Upload" question types to their forms.
- This allows respondents to upload files (images, PDFs) directly within the form.

#### 3. Branding (White Labeling)
- **Enterprise** users can have their Company Name and Company Logo displayed on the form.
- The `display_name` field in the JWT is used as the Company Name.
- The `logo_url` field in the JWT is used to display the logo.

#### 4. Data Export
- All users can export response data.
- **Enterprise** users have the additional option to export data in Microsoft Excel format (`.xlsx`), alongside the standard CSV format.

---

## JWT Token Integration

Third-party applications must generate a JWT token signed with an RSA private key (RS256) to authenticate users with Weladee Form.

### JWT Claims Structure

The JWT payload must contain the following custom claims:

```json
{
  "user_id": 123,
  "email": "admin@company.com",
  "display_name": "Acme Corp",     // Used as Company Name for Enterprise
  "role": "admin",                 // usually "admin" or "user"
  "customer_type": "enterprise",   // "sme", "standard", or "enterprise"
  "language": "en",                // Language preference: "en", "fr", or "th" (default: "en")
  "logo_url": "https://example.com/logo.png", // Optional, for Enterprise
  "iss": "weladee-form",
  "exp": 1735689600
}
```

### Sample Code (Go)

Below is a sample Go application that demonstrates how to generate a compatible JWT token using a private key (`private_key.pem`).

```go
package main

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// WeladeeUserClaims must match the structure expected by Weladee Form
type WeladeeUserClaims struct {
	UserID       int    `json:"user_id"`
	Email        string `json:"email"`
	DisplayName  string `json:"display_name"`
	Role         string `json:"role"`
	CustomerType string `json:"customer_type"` // enterprise, standard, sme
	Language     string `json:"language"`      // Language preference: en, fr, th (default: en)
	LogoURL      string `json:"logo_url"`
	jwt.RegisteredClaims
}

func main() {
	// Path to your RSA Private Key
	privateKeyPath := "private_key.pem"

	// User Data
	userID := 101
	email := "contact@acmecorp.com"
	companyName := "Acme Corporation"
	customerType := "enterprise"
	logoURL := "https://acmecorp.com/assets/logo.png"

	// Load Private Key
	keyBytes, err := os.ReadFile(privateKeyPath)
	if err != nil {
		panic(fmt.Sprintf("Failed to read private key: %v", err))
	}

	block, _ := pem.Decode(keyBytes)
	if block == nil {
		panic("Failed to parse PEM block containing the key")
	}

	privateKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		// Try PKCS8 if PKCS1 fails
		pk8, err2 := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err2 != nil {
			panic(fmt.Sprintf("Failed to parse private key: %v", err))
		}
		privateKey = pk8.(*rsa.PrivateKey)
	}

	// Create Claims
	claims := WeladeeUserClaims{
		UserID:       userID,
		Email:        email,
		DisplayName:  companyName,
		Role:         "admin",
		CustomerType: customerType,
		Language:     "en", // Default language
		LogoURL:      logoURL,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "weladee-portal",
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
		},
	}

	// Sign Token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(privateKey)
	if err != nil {
		panic(fmt.Sprintf("Failed to sign token: %v", err))
	}

	fmt.Println("Generated Weladee Form Token:")
	fmt.Println(signedToken)
}
```

### Verification

Weladee Form will validate this token using the corresponding **Public Key** configured via `JWT_PUBLIC_KEY_PATH`.
