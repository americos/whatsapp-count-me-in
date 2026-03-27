/** Maps all accepted command strings (EN + ES) to canonical action names. */
const aliases: Record<string, string> = {
  '!create':    'create',
  '!crear':     'create',
  '!join':      'join',
  '!unirse':    'join',
  '!waitlist':  'waitlist',
  '!espera':    'waitlist',
  '!leave':     'leave',
  '!salir':     'leave',
  '!status':    'status',
  '!estado':    'status',
  '!cancel':    'cancel',
  '!cancelar':  'cancel',
  '!lang':      'lang',
  '!idioma':    'lang',
};

export function resolveCommand(raw: string): string | undefined {
  return aliases[raw];
}
