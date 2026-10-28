#!/bin/bash
input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name')
model_id=$(echo "$input" | jq -r '.model.id')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total_input=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
total_output=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')

# Git branch
cwd=$(echo "$input" | jq -r '.cwd')
branch=""
if git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  b=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
  [ -n "$b" ] && branch="$b"
fi

# Cost calculation
cost=""
if [ "$total_input" -gt 0 ] 2>/dev/null || [ "$total_output" -gt 0 ] 2>/dev/null; then
  cost=$(echo "$model_id $total_input $total_output" | awk '{
    model=$1; inp=$2; out=$3
    if (model ~ /opus-4/) { in_price=15; out_price=75 }
    else if (model ~ /sonnet-4|sonnet-3-7|sonnet-3\.7/) { in_price=3; out_price=15 }
    else if (model ~ /haiku-3-5|haiku-3\.5/) { in_price=0.80; out_price=4 }
    else if (model ~ /haiku/) { in_price=0.25; out_price=1.25 }
    else { in_price=3; out_price=15 }
    total = (inp / 1000000 * in_price) + (out / 1000000 * out_price)
    if (total < 0.01) printf "~$0.00"
    else printf "$%.2f", total
  }')
fi

# Context percentage
ctx=""
[ -n "$used" ] && ctx="$(printf '%.0f' "$used")"

# Token display (format: 12.3K / 1.5K)
tokens=""
if [ "$total_input" -gt 0 ] 2>/dev/null || [ "$total_output" -gt 0 ] 2>/dev/null; then
  fmt_in=$(echo "$total_input" | awk '{
    if ($1 >= 1000000) printf "%.1fM", $1/1000000
    else if ($1 >= 1000) printf "%.1fK", $1/1000
    else printf "%d", $1
  }')
  fmt_out=$(echo "$total_output" | awk '{
    if ($1 >= 1000000) printf "%.1fM", $1/1000000
    else if ($1 >= 1000) printf "%.1fK", $1/1000
    else printf "%d", $1
  }')
  tokens="${fmt_in}↑ ${fmt_out}↓"
fi

# Rate limits (Pro/Max only)
rate_5h=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
rate_7d=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
reset_5h=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

# Build colorful output
R=$'\e[0m'
CYAN=$'\e[36m'
YELLOW=$'\e[33m'
GREEN=$'\e[32m'
MAGENTA=$'\e[35m'
DIM=$'\e[90m'
BLUE=$'\e[34m'
RED=$'\e[31m'
WHITE=$'\e[97m'

out="${CYAN}✦ ${model}${R}"
[ -n "$branch" ] && out="${out} ${DIM}│${R} ${YELLOW}⎇ ${branch}${R}"
[ -n "$ctx" ] && out="${out} ${DIM}│${R} ${GREEN}◈ ${ctx}%${R}"
[ -n "$tokens" ] && out="${out} ${DIM}│${R} ${BLUE}⇅ ${tokens}${R}"
[ -n "$cost" ] && out="${out} ${DIM}│${R} ${MAGENTA}$ ${cost}${R}"

if [ -n "$rate_5h" ]; then
  pct_5h_val=$(printf '%.0f' "$rate_5h")
  rem_5h=$((100 - pct_5h_val))

  # Color for 5h based on remaining
  if [ "$rem_5h" -le 10 ]; then
    C5H=$RED
  elif [ "$rem_5h" -le 30 ]; then
    C5H=$YELLOW
  else
    C5H=$GREEN
  fi

  out="${out} ${DIM}│${R} ${MAGENTA}⚡${R}"
  out="${out} ${DIM}5h:${R}${C5H}${rem_5h}%left${R}"

  # Countdown timer
  if [ -n "$reset_5h" ]; then
    now=$(date +%s)
    diff=$(( ${reset_5h%.*} - now ))
    if [ "$diff" -gt 0 ]; then
      hours=$((diff / 3600))
      mins=$(( (diff % 3600) / 60 ))
      if [ "$hours" -gt 0 ]; then
        tl="${hours}h${mins}m"
      else
        tl="${mins}m"
      fi
      out="${out}${DIM}(${R}${CYAN}↻${tl}${R}${DIM})${R}"
    fi
  fi

  # 7d quota
  if [ -n "$rate_7d" ]; then
    pct_7d_val=$(printf '%.0f' "$rate_7d")
    rem_7d=$((100 - pct_7d_val))

    if [ "$rem_7d" -le 10 ]; then
      C7D=$RED
    elif [ "$rem_7d" -le 30 ]; then
      C7D=$YELLOW
    else
      C7D=$GREEN
    fi

    out="${out} ${DIM}7d:${R}${C7D}${rem_7d}%left${R}"
  fi
fi

echo -n "$out"
