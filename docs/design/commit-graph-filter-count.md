# Commit-graph filter count callback

The `write_option_max_new_filters` callback parses base-ten `strtol` text,
requires its entire input to be consumed, and assigns the result to a C
`int`. The catalogue uses the existing signed decimal cast model, including
the selected C `long` width, rather than a configuration integer grammar.
Empty text becomes zero; leading C whitespace and a sign are accepted
when followed by digits. Trailing whitespace, suffixes, fractions and
hexadecimal prefixes fail. Overflow saturates in the native long width
before the int conversion; there is no extra nonnegative restriction.

Negation is a valueless flag that sets `-1` and bypasses argument parsing;
an explicit negative value remains a value-bearing option. Earlier invalid callbacks
remain errors even when followed by a valid value or help; help first
preempts later callbacks. Original text is preserved in argv. Dynamic
strings remain runtime-owned.

Git 2.25 does not register this option. Native tests distinguish that
unsupported option from callback rejection on later selected versions.
Finite help controls do not prove graph-writing results or complete the
command audit.
