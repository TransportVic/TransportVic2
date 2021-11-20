#!/bin/bash
DIRNAME=$(dirname "$0")

"$DIRNAME/load-type.sh" 4
node "$DIRNAME/extra/load-788-stop-numbers.js"
"$DIRNAME/load-type.sh" 6
#"$DIRNAME/load-type.sh" 7   # Telebus replaced by Flexiride
#"$DIRNAME/load-type.sh" 8   # Night bus moved to 4- routes
"$DIRNAME/load-type.sh" 11
