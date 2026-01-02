package utils

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/weladee/weladee-form/internal/db/sqlc"
)

// ResponseRow represents one row in the export (one response + its answers)
type ResponseRow struct {
	ResponseID      uuid.UUID
	SubmittedAt     time.Time
	Completed       bool
	RespondentName  string
	RespondentEmail string
	Answers         map[uuid.UUID]string // questionID -> formatted answer
}

// ExportResponsesToCSV generates a CSV byte slice from a list of responses with answers
func ExportResponsesToCSV(
	questions []sqlc.FormQuestion,
	responsesWithAnswers []sqlc.GetFormResponsesWithAnswersRow,
) ([]byte, error) {
	if len(questions) == 0 {
		return nil, fmt.Errorf("no questions provided")
	}

	// Sort questions by order_index for consistent column order
	sort.Slice(questions, func(i, j int) bool {
		return questions[i].OrderIndex < questions[j].OrderIndex
	})

	// Prepare header
	header := []string{
		"Response ID",
		"Submitted At",
		"Completed",
		"Respondent Name",
		"Respondent Email",
	}

	questionMap := make(map[uuid.UUID]string)
	for _, q := range questions {
		header = append(header, q.Label)
		questionMap[q.ID] = q.Label
	}

	// Build rows - Group answers by response
	var rows [][]string
	_ = rows // Placeholder - we build rows from grouped data below

	// Alternative approach: process grouped by response
	// This is a simplified version assuming you fetch all answers separately

	// For demonstration, we'll assume responsesWithAnswers contains one entry per answer
	// Group them
	grouped := make(map[uuid.UUID]ResponseRow)
	for _, ra := range responsesWithAnswers {
		respID := ra.ResponseID
		row, exists := grouped[respID]
		if !exists {
			row = ResponseRow{
				ResponseID:      respID,
				SubmittedAt:     ra.SubmittedAt.Time,
				Completed:       ra.Completed,
				RespondentName:  ra.RespondentName.String,
				RespondentEmail: ra.RespondentEmail.String,
				Answers:         make(map[uuid.UUID]string),
			}
		}

		// Format answer based on type
		answerStr := formatAnswer(ra)
		// Extract UUID from pgtype.UUID
		questionID, _ := uuid.FromBytes(ra.QuestionID.Bytes[:16])
		row.Answers[questionID] = answerStr

		grouped[respID] = row
	}

	// Convert to CSV rows
	for _, row := range grouped {
		csvRow := []string{
			row.ResponseID.String(),
			row.SubmittedAt.Format("2006-01-02 15:04:05"),
			fmt.Sprintf("%t", row.Completed),
			row.RespondentName,
			row.RespondentEmail,
		}

		for _, q := range questions {
			val, ok := row.Answers[q.ID]
			if ok {
				csvRow = append(csvRow, val)
			} else {
				csvRow = append(csvRow, "")
			}
		}
		rows = append(rows, csvRow)
	}

	// Generate CSV
	buf := &bytes.Buffer{}
	writer := csv.NewWriter(buf)
	defer writer.Flush()

	// Write header
	if err := writer.Write(header); err != nil {
		return nil, err
	}

	// Write rows
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	return buf.Bytes(), nil
}

// formatAnswer converts an answer to a human-readable string
func formatAnswer(row sqlc.GetFormResponsesWithAnswersRow) string {
	if row.AnswerText.Valid {
		return row.AnswerText.String
	}
	if row.AnswerNumber.Valid {
		flt, err := row.AnswerNumber.Float64Value()
		if err == nil {
			return fmt.Sprintf("%.2f", flt.Float64)
		}
	}
	if row.AnswerDate.Valid {
		return row.AnswerDate.Time.Format("2006-01-02")
	}
	if row.AnswerTime.Valid {
		micros := row.AnswerTime.Microseconds
		return time.Date(0, 0, 0, 0, 0, int(micros), 0, time.UTC).Format("15:04:05")
	}
	if len(row.AnswerChoices) > 0 {
		// Assuming JSONB with array of selected options
		// Simple string conversion - improve based on actual structure
		return string(row.AnswerChoices)
	}
	if row.AnswerFileUrl.Valid {
		return row.AnswerFileUrl.String // or "File uploaded"
	}
	return ""
}

func ExportResponsesToJSON(
	questions []sqlc.FormQuestion,
	responsesWithAnswers []sqlc.GetFormResponsesWithAnswersRow,
	formID uuid.UUID,
) ([]byte, error) {
	if len(questions) == 0 {
		return nil, fmt.Errorf("no questions provided")
	}

	// Sort questions by order_index
	sort.Slice(questions, func(i, j int) bool {
		return questions[i].OrderIndex < questions[j].OrderIndex
	})

	// Build question lookup
	type QuestionInfo struct {
		ID    string `json:"id"`
		Label string `json:"label"`
		Type  string `json:"type"`
	}
	var questionInfos []QuestionInfo
	questionIDToLabel := make(map[uuid.UUID]string)
	for _, q := range questions {
		info := QuestionInfo{
			ID:    q.ID.String(),
			Label: q.Label,
			Type:  q.Type,
		}
		questionInfos = append(questionInfos, info)
		questionIDToLabel[q.ID] = q.Label
	}

	// Group answers by response
	type ResponseExport struct {
		ID              string                 `json:"id"`
		SubmittedAt     string                 `json:"submitted_at,omitempty"`
		Completed       bool                   `json:"completed"`
		RespondentName  string                 `json:"respondent_name,omitempty"`
		RespondentEmail string                 `json:"respondent_email,omitempty"`
		Answers         map[string]interface{} `json:"answers"`
	}

	grouped := make(map[uuid.UUID]*ResponseExport)
	for _, row := range responsesWithAnswers {
		respID := row.ResponseID

		resp, exists := grouped[respID]
		if !exists {
			submitted := ""
			if row.SubmittedAt.Valid {
				submitted = row.SubmittedAt.Time.Format(time.RFC3339)
			}

			resp = &ResponseExport{
				ID:              respID.String(),
				SubmittedAt:     submitted,
				Completed:       row.Completed,
				RespondentName:  getTextString(row.RespondentName),
				RespondentEmail: getTextString(row.RespondentEmail),
				Answers:         make(map[string]interface{}),
			}
			grouped[respID] = resp
		}

		// Format answer
		answerValue := formatAnswerForJSON(row)

		// Use question ID as key (more reliable than label)
		resp.Answers[row.QuestionID.String()] = answerValue
	}

	// Convert map to slice
	var responses []ResponseExport
	for _, r := range grouped {
		responses = append(responses, *r)
	}

	// Sort responses by submitted_at descending
	sort.Slice(responses, func(i, j int) bool {
		if responses[i].SubmittedAt == "" {
			return false
		}
		if responses[j].SubmittedAt == "" {
			return true
		}
		ti, _ := time.Parse(time.RFC3339, responses[i].SubmittedAt)
		tj, _ := time.Parse(time.RFC3339, responses[j].SubmittedAt)
		return ti.After(tj)
	})

	// Final payload
	exportPayload := map[string]interface{}{
		"form_id":     formID.String(),
		"exported_at": time.Now().Format(time.RFC3339),
		"questions":   questionInfos,
		"responses":   responses,
		"total":       len(responses),
	}

	// Pretty-print JSON
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(exportPayload); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// Helper to safely get string from pgtype.Text
func getTextString(txt pgtype.Text) string {
	if txt.Valid {
		return txt.String
	}
	return ""
}

// Enhanced answer formatting for JSON
func formatAnswerForJSON(row sqlc.GetFormResponsesWithAnswersRow) interface{} {
	if row.AnswerText.Valid {
		return row.AnswerText.String
	}
	if row.AnswerNumber.Valid {
		flt, err := row.AnswerNumber.Float64Value()
		if err == nil {
			return flt.Float64
		}
	}
	if row.AnswerDate.Valid {
		return row.AnswerDate.Time.Format("2006-01-02") // ISO date
	}
	if row.AnswerTime.Valid {
		micros := row.AnswerTime.Microseconds
		return time.Date(0, 0, 0, 0, 0, int(micros), 0, time.UTC).Format("15:04:05")
	}
	if len(row.AnswerChoices) > 0 {
		// Try to unmarshal as array or object
		var choices interface{}
		if err := json.Unmarshal(row.AnswerChoices, &choices); err == nil {
			return choices
		}
		return string(row.AnswerChoices)
	}
	if row.AnswerFileUrl.Valid {
		return map[string]string{
			"type": "file",
			"url":  row.AnswerFileUrl.String,
		}
	}
	return nil
}
