# HAMH CLI

Command line interface for the Hermes Agent Management Hub.

## Installation

```bash
cd cli
npm install -g .
```

Or run directly:
```bash
node hamh.js <command>
```

## Configuration

```bash
# Set HAMH URL and API key
hamh config --set url https://hamh.oddsifylabs.com
hamh config --set key YOUR_API_KEY
```

Or use environment variables:
```bash
export HAMH_URL=https://hamh.oddsifylabs.com
export HAMH_API_KEY=your_key_here
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `hamh status` | `hamh s` | Show fleet status |
| `hamh send "@markus post-x hello"` | — | Send a command to HAMH |
| `hamh inbox` | `hamh i` | Check Director inbox & agent reports |
| `hamh logs [--limit N]` | — | Show activity log |
| `hamh workers` | `hamh w` | List all workers |
| `hamh config` | `hamh c` | Show configuration |

## Examples

```bash
# Check fleet status
hamh status

# Send a task to Markus
hamh send "@markus post-x Launching new product today!"

# Send a task to Miah
hamh send "@miah deploy latest to production"

# Check for messages from Octavia
hamh inbox

# View recent activity
hamh logs --limit 20
```
