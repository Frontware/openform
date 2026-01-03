# Weladee Form Duplicate Code Detection & Refactoring  
**(Golang, Next.js, and PostgreSQL/SQLC)**

## Objective
Analyze the full Weladee Form project (https://github.com/Frontware/openform/tree/feature/grpc-migration) and identify duplicate, near-duplicate, or very similar code across all three parts of the stack:  
- Go backend (cmd/, internal/, proto/)  
- Next.js frontend (app/, components/, lib/, hooks/, etc.)  
- PostgreSQL/SQLC queries (sql/ folder)  

Propose clean refactoring solutions to eliminate duplication, improve maintainability, and keep the beautiful design intact.

## Instructions

### 1. Go Code Analysis
**Scan the entire Go backend** (cmd/, internal/, proto/, etc.) for:  
- Exact duplicate functions or methods  
- Functions with identical or nearly identical logic (different variable names, minor differences)  
- Repeated code blocks across multiple files  
- Similar error handling patterns  
- Similar validation or helper logic used in multiple places  

### 2. Next.js Code Analysis
**Scan the entire Next.js frontend** (app/, components/, lib/, hooks/, store/, utils/, types/, etc.) for:  
- Duplicate React components or UI elements  
- Repeated form fields, buttons, or layout patterns  
- Identical or nearly identical API calls (gRPC client usage)  
- Duplicate validation logic (e.g., Zod schemas, form handling)  
- Repeated useEffect, state management, or loading states  
- Similar Tailwind/shadcn UI code blocks  
- Duplicate page layouts or form player logic  

### 3. SQL/SQLC Query Analysis
**Scan the sql/ folder** (sql/schema/ and sql/queries/) for:  
- Duplicate or nearly identical SQL queries across different `.sql` files  
- Queries with similar WHERE clauses, JOINs, or filtering logic  
- Repeated CTEs or subqueries  
- Similar INSERT/UPDATE/DELETE operations with slight variations  
- Queries that differ only in parameter names or minor conditions  
- Redundant query functions that could be consolidated with optional parameters  

### 4. For each duplicate found (any part of the stack), provide:  
- Location (file paths and line numbers for Go/Next.js; query names and file paths for SQL)  
- The duplicated code/query sections (side-by-side comparison if possible)  
- Similarity percentage or assessment  
- Root cause analysis (why was it duplicated?)  

### 5. Propose refactoring solutions:

**For Go Code:**  
- Extract common logic into shared helper functions or methods  
- Create generic/parameterized functions where applicable  
- Suggest utility packages for reusable patterns  
- Consider using interfaces where appropriate  
- Ensure solutions follow Go conventions and idiomatic patterns  

**For Next.js Code:**  
- Extract reusable React components (e.g., <QuestionBlock />, <TextInput />, <SubmitButton />)  
- Create custom hooks for repeated logic (e.g., useFormSubmission, useGrpcForm)  
- Share Zod schemas or validation functions  
- Consolidate gRPC client calls into a single service file  
- Use UI component library patterns (shadcn/ui) consistently  
- Extract common layouts or page sections  

**For SQL/SQLC Queries:**  
- Consolidate similar queries into parameterized versions with nullable/optional parameters  
- Extract common CTEs or subqueries into reusable query fragments  
- Use `sqlc.narg()` or `sqlc.arg()` for optional filtering  
- Create base queries with variations through query composition  
- Suggest stored functions or views for frequently duplicated logic  
- Utilize `COALESCE()` or conditional logic for query variations  
- Consider `sqlc.embed()` for reusable query fragments  

### 6. Implementation priority:  
- Mark high-priority deduplication targets (most frequently duplicated, largest code blocks/queries/components)  
- Suggest refactoring order (dependencies, integration safety)  
- Estimate impact (lines saved, number of files affected, maintainability improvement)  
- Identify cross-cutting duplications (e.g., same validation logic in Next.js Zod schemas and Go backend)  

### 7. Generate refactored code:  
- Show before/after comparisons  
- Provide complete, runnable refactored implementations  
- Include any new helper functions, custom hooks, components, utilities, or consolidated queries needed  
- Add brief comments explaining the refactoring approach  
- Ensure SQLC annotations are correct and will generate valid Go code  
- Ensure Next.js code remains type-safe (TypeScript) and works with the existing gRPC client  

## Output Format

```
## Summary
- Total duplicate patterns found: X (Go: X, Next.js: X, SQL: X)
- Estimated code saved: X lines (Go: X, Next.js: X, SQL: X)
- Priority levels: High (X), Medium (X), Low (X)

## Go Code Findings

### [Priority] Duplicate #1: [Description]
**Locations:** 
- internal/handler/form.go:line-line
- internal/handler/response.go:line-line

**Current Code:**
[code blocks]

**Analysis:** [why it's duplicated, impact]

**Proposed Solution:** [explain the refactoring approach]

**Refactored Code:**
[new shared function + updated call sites]

---

## Next.js Code Findings

### [Priority] Duplicate #1: [Description]
**Locations:**
- app/(form-player)/f/[id]/QuestionText.tsx
- app/(form-player)/f/[id]/QuestionEmail.tsx

**Current Code:**
[side-by-side component code]

**Analysis:** [why it's duplicated, impact]

**Proposed Solution:** [explain the refactoring approach]

**Refactored Code:**
[new generic <QuestionInput type="text" /> component + usage examples]

---

## SQL/SQLC Query Findings

### [Priority] SQL Duplicate #1: [Description]
**Locations:**
- sql/queries/form.sql (function: GetFormByID)
- sql/queries/form.sql (function: GetPublicFormByID)

**Current Queries:**
```sql
-- Query 1
[SQL code]

-- Query 2
[SQL code]
```

**Analysis:** [why it's duplicated, similarity assessment, impact]

**Proposed Solution:** [explain consolidation approach]

**Refactored Query:**
```sql
[consolidated parameterized query with SQLC annotations]
```

**Updated Go Usage:**
```go
[example of how to call the refactored query]
```

---

## Cross-Cutting Duplications
[Patterns that appear in multiple parts of the stack, e.g., form validation rules duplicated in Zod schemas (Next.js) and Go handlers, suggesting a shared schema approach]
```

## Additional Considerations

### Go Code
- Preserve backward compatibility where possible (or note breaking changes)  
- Maintain existing error handling and edge cases  
- Keep performance characteristics the same or better  
- Suggest any tooling (golangci-lint rules, custom linters) to prevent future duplication  

### Next.js Code
- Keep the design 100% unchanged (no visual regression)  
- Maintain mobile-first responsiveness  
- Preserve accessibility (ARIA labels, etc.)  
- Keep TypeScript types accurate  
- Ensure refactored components work in both form editor and form player  
- Suggest adding Storybook examples for new reusable components  

### SQL/SQLC Queries
- Ensure refactored queries maintain the same result sets and performance  
- Verify that SQLC code generation produces the expected Go signatures  
- Test with NULL values and edge cases for optional parameters  
- Consider database index implications for consolidated queries  
- Document query parameter conventions for team consistency  
- Ensure database query plans remain efficient after refactoring  

### Integration Points
- Identify where duplication spans the stack (e.g., same field validation in SQL constraints → Go → Zod schemas)  
- Suggest shared validation logic (e.g., generate Zod schemas from protobuf)  
- Highlight opportunities to reduce both frontend and backend code at once  
- Consider if some duplication indicates missing abstraction layers (e.g., a shared "question renderer" service)

