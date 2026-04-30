#!/bin/bash
# Updates README.md with the latest pinned action ref
# Fetches the latest SHA from a GitHub repository and updates the pinned ref in README.md
# Outputs sha and ref to GITHUB_OUTPUT for use in subsequent steps

set -euo pipefail

# Validates required inputs are provided
# Args:
#   $1 - Repository owner
#   $2 - Repository name
# Returns:
#   0 on success, 1 on failure
validate_inputs() {
    local repo_owner="$1"
    local repo_name="$2"

    if [[ -z "$repo_owner" || -z "$repo_name" ]]; then
        echo "Error: repo-owner and repo-name are required" >&2
        return 1
    fi

    return 0
}

# Fetches the latest SHA from the repository
# Prefers tags over branch, resolves tag/branch to commit SHA
# Args:
#   $1 - Repository owner
#   $2 - Repository name
#   $3 - Optional specific SHA to use
# Returns:
#   SHA via stdout on success, non-zero on failure
fetch_sha() {
    local repo_owner="$1"
    local repo_name="$2"
    local sha="$3"

    if [[ -n "$sha" ]]; then
        echo "$sha"
        return 0
    fi

    local default_branch
    default_branch=$(gh api repos/"$repo_owner"/"$repo_name" -q '.default_branch')
    if [[ -z "$default_branch" ]]; then
        echo "Error: Failed to fetch default branch for $repo_owner/$repo_name" >&2
        return 1
    fi

    local tags
    tags=$(gh api repos/"$repo_owner"/"$repo_name"/tags -q '.[0].name')
    if [[ -n "$tags" && "$tags" != "null" ]]; then
        local tag_sha
        tag_sha=$(gh api repos/"$repo_owner"/"$repo_name"/git/ref/tags/"$tags" -q '.object.sha')

        local tag_type
        tag_type=$(gh api repos/"$repo_owner"/"$repo_name"/git/ref/tags/"$tags" -q '.object.type')
        if [[ "$tag_type" == "tag" ]]; then
            tag_sha=$(gh api repos/"$repo_owner"/"$repo_name"/git/tags/"$tag_sha" -q '.object.sha')
        fi

        if [[ -z "$tag_sha" ]]; then
            echo "Error: Failed to resolve SHA for tag $tags" >&2
            return 1
        fi

        echo "$tag_sha"
        return 0
    fi

    local branch_sha
    branch_sha=$(gh api repos/"$repo_owner"/"$repo_name"/git/ref/heads/"$default_branch" -q '.object.sha')
    if [[ -z "$branch_sha" ]]; then
        echo "Error: Failed to resolve SHA for branch $default_branch" >&2
        return 1
    fi

    echo "$branch_sha"
    return 0
}

# Resolves the ref name (tag or branch) for display purposes
# Args:
#   $1 - Repository owner
#   $2 - Repository name
#   $3 - Optional specific SHA used
# Returns:
#   Ref name via stdout on success, non-zero on failure
resolve_ref() {
    local repo_owner="$1"
    local repo_name="$2"
    local sha="$3"

    if [[ -n "$sha" ]]; then
        echo "sha"
        return 0
    fi

    local default_branch
    default_branch=$(gh api repos/"$repo_owner"/"$repo_name" -q '.default_branch')
    if [[ -z "$default_branch" ]]; then
        echo "Error: Failed to fetch default branch for $repo_owner/$repo_name" >&2
        return 1
    fi

    local tags
    tags=$(gh api repos/"$repo_owner"/"$repo_name"/tags -q '.[0].name')
    if [[ -n "$tags" && "$tags" != "null" ]]; then
        echo "$tags"
        return 0
    fi

    echo "$default_branch"
    return 0
}

# Updates the pinned ref in README.md using sed replacement
# Args:
#   $1 - Repository owner
#   $2 - Repository name
#   $3 - SHA to pin to
#   $4 - Path to README file
update_readme() {
    local repo_owner="$1"
    local repo_name="$2"
    local sha="$3"
    local readme_path="$4"

    sed -i "s|$repo_owner/$repo_name@[a-f0-9]\{7,\}|$repo_owner/$repo_name@$sha|g" "$readme_path"
    echo "Updated $readme_path to use $sha"
}

# Main entry point
# Args:
#   $1 - Repository owner
#   $2 - Repository name
#   $3 - Optional specific SHA
#   $4 - README path (default: README.md)
main() {
    local repo_owner="${1:-}"
    local repo_name="${2:-}"
    local sha="${3:-}"
    local readme_path="${4:-README.md}"

    validate_inputs "$repo_owner" "$repo_name" || return 1

    local resolved_sha
    resolved_sha=$(fetch_sha "$repo_owner" "$repo_name" "$sha") || return 1

    local ref
    ref=$(resolve_ref "$repo_owner" "$repo_name" "$sha") || return 1

    update_readme "$repo_owner" "$repo_name" "$resolved_sha" "$readme_path"

    echo "sha=$resolved_sha" >> "$GITHUB_OUTPUT"
    echo "ref=$ref" >> "$GITHUB_OUTPUT"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi