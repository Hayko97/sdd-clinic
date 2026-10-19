// Used before browser draft persistence and before any prompt is sent to a model.
export function containsConnectionDetails(text: string) {
  return /(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|sqlite|ssh):\/\/|\w+:\/\/[^\s/@]+:[^\s@]+@|(?:^|\n)\s*(?:\/credentials|ssh\s)|-----BEGIN [\w ]*PRIVATE KEY-----|\b(?:\w+[_-])?(?:password|passwd|pwd|passphrase|private[_ -]?key|api[_ -]?key|access[_ -]?token|secret|DB_HOST|DATABASE_URL|SSH_HOST|PGHOST|PGPASSWORD)["']?\s*[:=]/i.test(
    text,
  );
}
