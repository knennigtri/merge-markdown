# Git Hooks

This directory contains git hooks that help maintain code quality and consistency.

## Available Hooks

### pre-push
- **Purpose**: Runs `npm run build` before every push to ensure the code builds successfully
- **Behavior**: If the build fails, the push is aborted with an error message
- **Location**: `hooks/pre-push`

## Installation

```bash
# Copy the hook to git hooks directory
cp hooks/pre-push .git/hooks/pre-push

# Make it executable
chmod +x .git/hooks/pre-push
```