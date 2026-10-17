# Lists every open SonarQube issue and every security hotspot.
# Sourced by the sonarless job scripts.
#
# SonarQube 25 ignores resolved=false and answers with an empty list, so the
# search uses issueStatuses. The line field is often null. The code location
# is textRange, whose offsets are 0-based and whose end offset is exclusive.

code_ref_def='
def code_ref:
  def file:
    if . == null or . == "" then "-"
    elif contains(":") then sub("^[^:]+:"; "")
    else . end;
  (.component | file) as $path
  | (.line // .textRange.startLine) as $start
  | (.textRange.endLine // $start) as $end
  | .textRange.startOffset as $col
  | (.textRange.endOffset // $col) as $col_end
  | if $start == null then $path
    elif $col != null and ($end | tostring) == ($start | tostring) then
      $path + ":" + ($start | tostring) + ":" + (($col + 1) | tostring) + "-" + ($col_end | tostring)
    elif ($end | tostring) != ($start | tostring) then
      $path + ":" + ($start | tostring) + "-" + ($end | tostring)
    else
      $path + ":" + ($start | tostring)
    end;
'

fetch_sonar_pages() {
  local path="$1"
  local array_key="$2"
  local outfile="$3"
  shift 3

  local tmp
  tmp="$(mktemp -d)"
  local page=1
  local page_size="${SONAR_PAGE_SIZE:-500}"
  local total=0
  echo '[]' > "${tmp}/items.json"

  while [ "$page" -le 40 ]; do
    curl -sS -G -u "$SONAR_AUTH" \
      "$@" \
      --data-urlencode "ps=${page_size}" \
      --data-urlencode "p=${page}" \
      "${SONAR_URL}${path}" > "${tmp}/page.json"

    if ! jq empty "${tmp}/page.json" >/dev/null 2>&1 || jq -e '.errors' "${tmp}/page.json" >/dev/null 2>&1; then
      echo "❌ ${path} no devolvió un listado"
      cat "${tmp}/page.json"
      rm -rf "$tmp"
      exit 1
    fi

    total="$(jq -r '.paging.total // .total // 0' "${tmp}/page.json")"
    local count
    count="$(jq -r --arg key "$array_key" '(.[$key] // []) | length' "${tmp}/page.json")"

    jq -s --arg key "$array_key" '.[0] + (.[1][$key] // [])' "${tmp}/items.json" "${tmp}/page.json" > "${tmp}/next.json"
    mv "${tmp}/next.json" "${tmp}/items.json"

    if [ "$count" -lt "$page_size" ]; then
      break
    fi
    page=$((page + 1))
  done

  if [ "$page" -gt 40 ]; then
    echo "❌ ${path} superó el máximo de páginas"
    rm -rf "$tmp"
    exit 1
  fi

  jq -n \
    --arg key "$array_key" \
    --argjson total "$total" \
    --slurpfile items "${tmp}/items.json" \
    '{total: $total} + {($key): $items[0]}' > "$outfile"
  rm -rf "$tmp"

  local returned
  returned="$(jq -r --arg key "$array_key" '(.[$key] // []) | length' "$outfile")"
  if [ "$returned" != "$total" ]; then
    echo "❌ ${path} devolvió ${returned} de ${total}. El listado está incompleto."
    exit 1
  fi
}

fetch_sonar_issues() {
  local project="$1"
  local outfile="$2"
  fetch_sonar_pages "/api/issues/search" "issues" "$outfile" \
    --data-urlencode "componentKeys=${project}" \
    --data-urlencode "issueStatuses=OPEN,CONFIRMED"
}

fetch_sonar_hotspots() {
  local project="$1"
  local outfile="$2"
  fetch_sonar_pages "/api/hotspots/search" "hotspots" "$outfile" \
    --data-urlencode "projectKey=${project}"
}

print_sonar_issues() {
  local file="$1"
  local count
  count="$(jq -r '(.issues // []) | length' "$file")"
  if [ "$count" -eq 0 ]; then
    echo "Ninguno."
    return
  fi
  jq -r "${code_ref_def}"'
    .issues[]? as $item
    | $item
    | code_ref as $primary
    | (
        [
          (.type // "-"),
          (.severity // .impacts[0].severity // "-"),
          $primary,
          (.rule // "-"),
          ((.message // "-") | gsub("\\s+"; " "))
        ] | join(" | ")
      ),
      (
        .flows[]?.locations[]?
        | code_ref as $extra
        | select($extra != $primary)
        | "  " + $extra + (if (.msg // "") != "" then " | " + (.msg | gsub("\\s+"; " ")) else "" end)
      )
  ' "$file"
  echo "Total: ${count}"
}

print_sonar_hotspots() {
  local file="$1"
  local count
  count="$(jq -r '(.hotspots // []) | length' "$file")"
  if [ "$count" -eq 0 ]; then
    echo "Ninguno."
    return
  fi
  jq -r "${code_ref_def}"'
    .hotspots[]? as $item
    | $item
    | code_ref as $primary
    | (
        [
          "HOTSPOT",
          (.status // "-"),
          $primary,
          (.ruleKey // .rule // "-"),
          (.securityCategory // "-"),
          ((.message // "-") | gsub("\\s+"; " "))
        ] | join(" | ")
      ),
      (
        .flows[]?.locations[]?
        | code_ref as $extra
        | select($extra != $primary)
        | "  " + $extra + (if (.msg // "") != "" then " | " + (.msg | gsub("\\s+"; " ")) else "" end)
      )
  ' "$file"
  echo "Total: ${count}"
}
