# Metadata Mover

This plugin moves notes based on their frontmatter metadata.

Create and manage rules in **Settings → Metadata Mover**. Each rule has one or more property/value conditions and a destination folder. Every condition in a rule must match.

For example, a rule with `type` = `project` and `status` = `archived` moves matching notes to the configured folder. Edit rules to add conditions, duplicate them, or change their order. The most specific matching rule takes precedence; when rules have equal specificity, the rule listed first wins.

You can also move a note into the same folder as the note linked by its configured “up” property, and exclude folders from automatic moves.
