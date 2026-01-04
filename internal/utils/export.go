package utils

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"

	"github.com/weladee/weladee-form/internal/db/sqlc"
)

// CSVExporter handles CSV export
type CSVExporter struct {
	buffer *bytes.Buffer
	writer *csv.Writer
}

func NewCSVExporter() *CSVExporter {
	buffer := &bytes.Buffer{}
	return &CSVExporter{
		buffer: buffer,
		writer: csv.NewWriter(buffer),
	}
}

func (e *CSVExporter) WriteHeader(headers []string) error {
	return e.writer.Write(headers)
}

func (e *CSVExporter) WriteRow(row []string) error {
	return e.writer.Write(row)
}

func (e *CSVExporter) GetBytes() []byte {
	e.writer.Flush()
	return e.buffer.Bytes()
}

// ExcelExporter handles Excel export
type ExcelExporter struct {
	file      *excelize.File
	sheetName string
	rowIndex  int
}

func NewExcelExporter(sheetName string) *ExcelExporter {
	f := excelize.NewFile()
	index, _ := f.NewSheet(sheetName)
	f.SetActiveSheet(index)
	f.DeleteSheet("Sheet1") // Remove default sheet

	return &ExcelExporter{
		file:      f,
		sheetName: sheetName,
		rowIndex:  1,
	}
}

func (e *ExcelExporter) WriteHeader(headers []string) error {
	// Style for headers
	style, err := e.file.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 12,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#4F46E5"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
	})
	if err != nil {
		return err
	}

	for i, header := range headers {
		cell := fmt.Sprintf("%s%d", columnName(i), e.rowIndex)
		e.file.SetCellValue(e.sheetName, cell, header)
		e.file.SetCellStyle(e.sheetName, cell, cell, style)
	}

	e.rowIndex++
	return nil
}

func (e *ExcelExporter) WriteRow(row []string) error {
	for i, value := range row {
		cell := fmt.Sprintf("%s%d", columnName(i), e.rowIndex)
		// Check if value is numeric and set accordingly to avoid warnings
		if floatVal, err := strconv.ParseFloat(value, 64); err == nil {
			e.file.SetCellValue(e.sheetName, cell, floatVal)
		} else {
			e.file.SetCellValue(e.sheetName, cell, value)
		}
	}
	e.rowIndex++
	return nil
}

func (e *ExcelExporter) AddChart(chartType, title string, dataRange string) error {
	chart := &excelize.Chart{
		Type: excelize.Col, // Default to Column chart
		Series: []excelize.ChartSeries{
			{
				Name:       title,
				Categories: dataRange,
				Values:     dataRange,
			},
		},
		Title: []excelize.RichTextRun{
			{
				Text: title,
			},
		},
	}
    // Simple mapping for chart types if needed
    if chartType == "pie" {
        chart.Type = excelize.Pie
    }

	cell := fmt.Sprintf("H%d", e.rowIndex+2)
	return e.file.AddChart(e.sheetName, cell, chart)
}

func (e *ExcelExporter) GetBytes() ([]byte, error) {
	// Auto-fit columns
	for i := 0; i < 20; i++ {
		col := columnName(i)
		e.file.SetColWidth(e.sheetName, col, col, 15)
	}

	buffer := &bytes.Buffer{}
	if err := e.file.Write(buffer); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func columnName(index int) string {
	name := ""
	for index >= 0 {
		name = string(rune('A'+index%26)) + name
		index = index/26 - 1
	}
	return name
}

// ExportResponsesToCSV exports form responses to CSV format
func ExportResponsesToCSV(questions []sqlc.FormQuestion, rows []sqlc.GetFormResponsesWithAnswersRow) ([]byte, error) {
	exporter := NewCSVExporter()

	// Create header row
	headers := []string{"Response ID", "Submitted At", "Respondent Email", "Respondent Name"}
	for _, q := range questions {
		headers = append(headers, q.Label)
	}
	if err := exporter.WriteHeader(headers); err != nil {
		return nil, err
	}

	// Group answers by response
	responseMap := make(map[uuid.UUID]map[uuid.UUID]string)
	for _, row := range rows {
		if _, ok := responseMap[row.ResponseID]; !ok {
			responseMap[row.ResponseID] = make(map[uuid.UUID]string)
		}

		// Convert answer to string based on type
		var answerStr string
		if row.AnswerText.Valid {
			answerStr = row.AnswerText.String
		} else if row.AnswerNumber.Valid {
			flt, _ := row.AnswerNumber.Float64Value()
			answerStr = strconv.FormatFloat(flt.Float64, 'f', -1, 64)
		} else if row.AnswerDate.Valid {
			answerStr = row.AnswerDate.Time.Format("2006-01-02")
		} else if row.AnswerTime.Valid {
			micros := row.AnswerTime.Microseconds
			t := time.Date(0, 0, 0, 0, 0, int(micros), 0, time.UTC)
			answerStr = t.Format("15:04:05")
		} else if len(row.AnswerChoices) > 0 {
			answerStr = string(row.AnswerChoices)
		}

		// Convert pgtype.UUID to uuid.UUID for map key
		questionUUID, _ := uuid.FromBytes(row.QuestionID.Bytes[:])
		responseMap[row.ResponseID][questionUUID] = answerStr
	}

	// Write rows
	for _, row := range rows {
		// Only write once per response (check if we've already written this response)
		if !row.AnswerID.Valid {
			// This is a response without answers
			record := []string{
				row.ResponseID.String(),
				row.SubmittedAt.Time.Format(time.RFC3339),
				row.RespondentEmail.String,
				row.RespondentName.String,
			}
			// Add empty answers for all questions
			for range questions {
				record = append(record, "")
			}
			if err := exporter.WriteRow(record); err != nil {
				return nil, err
			}
		}
	}

	// Actually, let's iterate by unique responses
	seenResponses := make(map[uuid.UUID]bool)
	for _, row := range rows {
		if seenResponses[row.ResponseID] {
			continue
		}
		seenResponses[row.ResponseID] = true

		record := []string{
			row.ResponseID.String(),
			row.SubmittedAt.Time.Format(time.RFC3339),
			row.RespondentEmail.String,
			row.RespondentName.String,
		}

		// Add answers in question order
		for _, q := range questions {
			if answers, ok := responseMap[row.ResponseID]; ok {
				record = append(record, answers[q.ID])
			} else {
				record = append(record, "")
			}
		}

		if err := exporter.WriteRow(record); err != nil {
			return nil, err
		}
	}

	return exporter.GetBytes(), nil
}

// ExportResponsesToJSON exports form responses to JSON format
func ExportResponsesToJSON(questions []sqlc.FormQuestion, rows []sqlc.GetFormResponsesWithAnswersRow, formID uuid.UUID) ([]byte, error) {
	// Group answers by response
	responseMap := make(map[uuid.UUID]map[uuid.UUID]any)
	for _, row := range rows {
		if _, ok := responseMap[row.ResponseID]; !ok {
			responseMap[row.ResponseID] = make(map[uuid.UUID]any)
		}

		// Convert answer to appropriate type
		var answer any
		if row.AnswerText.Valid {
			answer = row.AnswerText.String
		} else if row.AnswerNumber.Valid {
			flt, _ := row.AnswerNumber.Float64Value()
			answer = flt.Float64
		} else if row.AnswerDate.Valid {
			answer = row.AnswerDate.Time.Format("2006-01-02")
		} else if row.AnswerTime.Valid {
			micros := row.AnswerTime.Microseconds
			t := time.Date(0, 0, 0, 0, 0, int(micros), 0, time.UTC)
			answer = t.Format("15:04:05")
		} else if len(row.AnswerChoices) > 0 {
			var choices map[string]any
			if err := json.Unmarshal(row.AnswerChoices, &choices); err == nil {
				answer = choices
			} else {
				answer = string(row.AnswerChoices)
			}
		}

		// Convert pgtype.UUID to uuid.UUID for map key
		questionUUID, _ := uuid.FromBytes(row.QuestionID.Bytes[:])
		responseMap[row.ResponseID][questionUUID] = answer
	}

	// Build output structure
	type OutputQuestion struct {
		ID       string `json:"id"`
		Label    string `json:"label"`
		Type     string `json:"type"`
		Required bool   `json:"required"`
	}

	type OutputResponse struct {
		ID            string                 `json:"id"`
		SubmittedAt   string                 `json:"submitted_at"`
		RespondentEmail string               `json:"respondent_email,omitempty"`
		RespondentName  string               `json:"respondent_name,omitempty"`
		Answers       map[string]any `json:"answers"`
	}

	type Output struct {
		FormID      string            `json:"form_id"`
		ExportedAt  string            `json:"exported_at"`
		Total       int               `json:"total_responses"`
		Questions   []OutputQuestion  `json:"questions"`
		Responses   []OutputResponse  `json:"responses"`
	}

	// Build questions list
	qlist := make([]OutputQuestion, 0, len(questions))
	for _, q := range questions {
		qlist = append(qlist, OutputQuestion{
			ID:       q.ID.String(),
			Label:    q.Label,
			Type:     q.Type,
			Required: q.Required,
		})
	}

	// Build responses list
	seenResponses := make(map[uuid.UUID]bool)
	responses := make([]OutputResponse, 0)
	for _, row := range rows {
		if seenResponses[row.ResponseID] {
			continue
		}
		seenResponses[row.ResponseID] = true

		resp := OutputResponse{
			ID:          row.ResponseID.String(),
			SubmittedAt: row.SubmittedAt.Time.Format(time.RFC3339),
			Answers:     make(map[string]any),
		}

		if row.RespondentEmail.Valid {
			resp.RespondentEmail = row.RespondentEmail.String
		}
		if row.RespondentName.Valid {
			resp.RespondentName = row.RespondentName.String
		}

		// Map answers by question ID
		if answers, ok := responseMap[row.ResponseID]; ok {
			for qid, answer := range answers {
				resp.Answers[qid.String()] = answer
			}
		}

		responses = append(responses, resp)
	}

	output := Output{
		FormID:     formID.String(),
		ExportedAt: time.Now().Format(time.RFC3339),
		Total:      len(responses),
		Questions:  qlist,
		Responses:  responses,
	}

	return json.MarshalIndent(output, "", "  ")
}

// ExportResponsesToExcel exports form responses to Excel format
func ExportResponsesToExcel(questions []sqlc.FormQuestion, rows []sqlc.GetFormResponsesWithAnswersRow) ([]byte, error) {
	exporter := NewExcelExporter("Responses")

	// Create header row
	headers := []string{"Response ID", "Submitted At", "Respondent Email", "Respondent Name"}
	for _, q := range questions {
		headers = append(headers, q.Label)
	}
	if err := exporter.WriteHeader(headers); err != nil {
		return nil, err
	}

	// Group answers by response
	responseMap := make(map[uuid.UUID]map[uuid.UUID]string)
	for _, row := range rows {
		if _, ok := responseMap[row.ResponseID]; !ok {
			responseMap[row.ResponseID] = make(map[uuid.UUID]string)
		}

		// Convert answer to string
		var answerStr string
		if row.AnswerText.Valid {
			answerStr = row.AnswerText.String
		} else if row.AnswerNumber.Valid {
			flt, _ := row.AnswerNumber.Float64Value()
			answerStr = strconv.FormatFloat(flt.Float64, 'f', -1, 64)
		} else if row.AnswerDate.Valid {
			answerStr = row.AnswerDate.Time.Format("2006-01-02")
		} else if row.AnswerTime.Valid {
			micros := row.AnswerTime.Microseconds
			t := time.Date(0, 0, 0, 0, 0, int(micros), 0, time.UTC)
			answerStr = t.Format("15:04:05")
		} else if len(row.AnswerChoices) > 0 {
			answerStr = string(row.AnswerChoices)
		}

		// Convert pgtype.UUID to uuid.UUID for map key
		questionUUID, _ := uuid.FromBytes(row.QuestionID.Bytes[:])
		responseMap[row.ResponseID][questionUUID] = answerStr
	}

	// Write rows
	seenResponses := make(map[uuid.UUID]bool)
	for _, row := range rows {
		if seenResponses[row.ResponseID] {
			continue
		}
		seenResponses[row.ResponseID] = true

		record := []string{
			row.ResponseID.String(),
			row.SubmittedAt.Time.Format(time.RFC3339),
			row.RespondentEmail.String,
			row.RespondentName.String,
		}

		// Add answers in question order
		for _, q := range questions {
			if answers, ok := responseMap[row.ResponseID]; ok {
				record = append(record, answers[q.ID])
			} else {
				record = append(record, "")
			}
		}

		if err := exporter.WriteRow(record); err != nil {
			return nil, err
		}
	}

	return exporter.GetBytes()
}