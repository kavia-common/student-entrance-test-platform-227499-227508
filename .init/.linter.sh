#!/bin/bash
cd /home/kavia/workspace/code-generation/student-entrance-test-platform-227499-227508/quiz_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

