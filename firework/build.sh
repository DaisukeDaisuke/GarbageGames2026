#!/bin/sh
set -eu

# Run from any directory. The output directory is relative to the caller.
project_dir=$(CDPATH= cd -P "$(dirname "$0")" && pwd -P)
output_dir=$project_dir

usage() {
    printf '%s\n' 'Usage: sh fire/build.sh [--output-dir DIRECTORY]'
}

case $# in
    0) ;;
    1)
        case $1 in
            -h|--help) usage; exit 0 ;;
            *) usage >&2; exit 2 ;;
        esac
        ;;
    2)
        if [ "$1" != '--output-dir' ] || [ -z "$2" ]; then
            usage >&2
            exit 2
        fi
        output_dir=$2
        ;;
    *) usage >&2; exit 2 ;;
esac

for source_file in src/index.html src/style.css src/fireworks.js src/app.js spec.md; do
    if [ ! -f "$project_dir/$source_file" ]; then
        printf 'build.sh: missing source: %s\n' "$source_file" >&2
        exit 1
    fi
done

# Retain the original document's final newline in its embedded JSON string.
spec_final_lf=0
if [ -s "$project_dir/spec.md" ] && [ -z "$(tail -c 1 "$project_dir/spec.md")" ]; then
    spec_final_lf=1
fi

mkdir -p "$output_dir"
output_dir=$(CDPATH= cd -P "$output_dir" && pwd -P)
temporary_file=$(mktemp "$output_dir/.fire-index.XXXXXXXX")
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

FIRE_PROJECT_DIR=$project_dir FIRE_SPEC_FINAL_LF=$spec_final_lf \
awk '
function fail(message) {
    print "build.sh: " message > "/dev/stderr"
    failed = 1
    exit 1
}

function emit_file(path, kind,    line, status) {
    while ((status = (getline line < path)) > 0) {
        if (kind == "script" && tolower(line) ~ /<\/script/) {
            close(path)
            fail("JavaScript contains an inline closing script tag: " path)
        }
        if (kind == "style" && tolower(line) ~ /<\/style/) {
            close(path)
            fail("CSS contains an inline closing style tag: " path)
        }
        print line
    }
    close(path)
    if (status < 0) fail("could not read " path)
}

function json_escape(value,    result, position, character) {
    result = ""
    for (position = 1; position <= length(value); position++) {
        character = substr(value, position, 1)
        if (character == "\\") result = result "\\\\"
        else if (character == "\"") result = result "\\\""
        else if (character == "\t") result = result "\\t"
        else if (character == "\r") result = result "\\r"
        else if (character == "\b") result = result "\\b"
        else if (character == "\f") result = result "\\f"
        else if (character == "<") result = result "\\u003c"
        else if (character == ">") result = result "\\u003e"
        else if (character == "&") result = result "\\u0026"
        else result = result character
    }
    return result
}

function emit_spec(path,    line, status, separator) {
    print "<script type=\"application/json\" id=\"spec-source\">"
    printf "\""
    separator = ""
    while ((status = (getline line < path)) > 0) {
        printf "%s%s", separator, json_escape(line)
        separator = "\\n"
    }
    close(path)
    if (status < 0) fail("could not read " path)
    if (ENVIRON["FIRE_SPEC_FINAL_LF"] == "1") printf "\\n"
    print "\""
    print "</script>"
}

BEGIN {
    project = ENVIRON["FIRE_PROJECT_DIR"]
}

/^[ \t]*<!-- INLINE_STYLE -->[ \t\r]*$/ {
    if (++style_count != 1) fail("duplicate INLINE_STYLE marker")
    print "<style>"
    emit_file(project "/src/style.css", "style")
    print "</style>"
    next
}

/^[ \t]*<!-- INLINE_FIREWORKS -->[ \t\r]*$/ {
    if (++fireworks_count != 1) fail("duplicate INLINE_FIREWORKS marker")
    print "<script>"
    emit_file(project "/src/fireworks.js", "script")
    print "</script>"
    next
}

/^[ \t]*<!-- INLINE_APP -->[ \t\r]*$/ {
    if (++app_count != 1) fail("duplicate INLINE_APP marker")
    print "<script>"
    emit_file(project "/src/app.js", "script")
    print "</script>"
    next
}

/^[ \t]*<!-- INLINE_SPEC -->[ \t\r]*$/ {
    if (++spec_count != 1) fail("duplicate INLINE_SPEC marker")
    emit_spec(project "/spec.md")
    next
}

{ print }

END {
    if (failed) exit 1
    if (style_count != 1 || fireworks_count != 1 || app_count != 1 || spec_count != 1) {
        print "build.sh: each INLINE marker must appear exactly once" > "/dev/stderr"
        exit 1
    }
}
' "$project_dir/src/index.html" > "$temporary_file"

chmod 644 "$temporary_file"
mv -f "$temporary_file" "$output_dir/index.html"
trap - EXIT HUP INT TERM
printf 'Built: %s/index.html\n' "$output_dir"
