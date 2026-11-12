from datetime import date

from cotizacion.rating.domain.rating import insured_age


def test_the_age_counts_full_years_up_to_the_birthday():
    assert insured_age(date(1990, 6, 15), date(2026, 6, 14)) == 35
    assert insured_age(date(1990, 6, 15), date(2026, 6, 15)) == 36


def test_a_minor_is_rated_with_the_minimum_insured_age():
    assert insured_age(date(2015, 1, 1), date(2026, 1, 1)) == 18
