---
name: ai-module
description: AI module domain expert. LangGraph workflows, email editor AI, document summarization, document Q&A, contact briefs, prompt history. Use when working in libs/modules/ai-module/ or with AI-powered features.
---
# AI Module

**Location:** `libs/modules/ai-module/src/`

## Entities

No database entities — this is a stateless AI integration module.

## Commands

- `email-editor` — AI-powered email writing assistance
- `document-summarizer` — summarize documents using AI
- `document-qa` — question-answering over documents
- `contact-brief` — generate contact briefs from CRM data
- `generate-completion` — generic AI completion

## Queries

- `get-prompt-history` — retrieve past AI prompt interactions

## External Integrations

- **LangGraph Client Service** — multiple LangGraph workflow endpoints:
  - Email Editor, Document Summarizer, Document QA, Document OCR, Categorization, Contact Brief
- **Custom Fields Client** — custom fields SDK for contact brief enrichment

## Key Technical Details

- LangGraph workflows support Python and JavaScript backends
- Service names mapped to client instances dynamically
- API keys and model configuration via environment variables
- Module namespace: `ai`
