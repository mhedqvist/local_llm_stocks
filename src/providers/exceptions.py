"""Typed exceptions for upstream data-provider failures.

The API layer maps these to stable HTTP status codes:

- ``RateLimitExceeded`` -> 429 (with ``Retry-After`` header)
- ``UpstreamError``     -> 502
- other provider errors -> 500

Raising typed exceptions (instead of generic ``Exception`` with a message
string) removes the fragile string-matching between the provider and the
API layer.
"""


class DataProviderError(Exception):
    """Base class for upstream data-provider failures."""


class RateLimitExceeded(DataProviderError):
    """The upstream provider rate-limited the request."""


class UpstreamError(DataProviderError):
    """Transport-level failure talking to the upstream provider (network,
    timeout, or a non-429 HTTP error)."""
