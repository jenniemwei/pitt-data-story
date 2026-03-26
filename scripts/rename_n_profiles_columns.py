#!/usr/bin/env python3
"""
Rename columns in data/n_profiles_new.csv using semantic names derived from
data/n__data_dict.csv (2022 ACS variables). Regenerates n_profiles_new.csv in place.
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILES = ROOT / "data" / "n_profiles_new.csv"
DICT_PATH = ROOT / "data" / "n__data_dict.csv"
MAP_OUT = ROOT / "data" / "n_profiles_new_column_map.csv"

# Semantic names keyed by original Var_2022_* column (from n__data_dict "Group or subgroup").
VAR_2022_SEMANTIC: dict[str, str] = {
    "Var_2022_TotalPopulation": "total_pop",
    "Var_2022_Race_1": "black_alone_pop",
    "Var_2022_Race_2": "white_alone_pop",
    "Var_2022_Race_3": "asian_alone_pop",
    "Var_2022_Race_4": "other_single_race_alone_pop",
    "Var_2022_Race_5": "two_or_more_race_pop",
    "Var_2022_Race_Per_1": "black_alone_share",
    "Var_2022_Race_Per_2": "white_alone_share",
    "Var_2022_Race_Per_3": "asian_alone_share",
    "Var_2022_Race_Per_4": "other_single_race_alone_share",
    "Var_2022_Race_Per_5": "two_or_more_race_share",
    "Var_2022_GroupQuarters": "group_quarters_pop",
    "Var_2022_GroupQuartersPer": "group_quarters_share",
    "Var_2022_Hispanic": "hispanic_pop",
    "Var_2022_Hispanic_Per": "hispanic_share",
    "Var_2022_Age_1": "pop_under_18",
    "Var_2022_Age_2": "pop_age_18_24",
    "Var_2022_Age_3": "pop_age_25_44",
    "Var_2022_Age_4": "pop_age_45_64",
    "Var_2022_Age_5": "pop_age_65_plus",
    "Var_2022_Age_Per_1": "share_under_18",
    "Var_2022_Age_Per_2": "share_age_18_24",
    "Var_2022_Age_Per_3": "share_age_25_44",
    "Var_2022_Age_Per_4": "share_age_45_64",
    "Var_2022_Age_Per_5": "share_age_65_plus",
    "Var_2022_School_1": "pop_age_3_plus",
    "Var_2022_School_2": "enrolled_k12_pop",
    "Var_2022_School_3": "enrolled_undergrad_or_grad_pop",
    "Var_2022_School_4": "enrolled_undergrad_pop",
    "Var_2022_School_5": "enrolled_grad_pop",
    "Var_2022_School_Per_2": "enrolled_k12_share_of_3plus",
    "Var_2022_School_Per_3": "enrolled_undergrad_or_grad_share_of_3plus",
    "Var_2022_School_Per_4": "enrolled_undergrad_share_of_3plus",
    "Var_2022_School_Per_5": "enrolled_grad_share_of_3plus",
    "Var_2022_foreign_1": "foreign_born_pop",
    "Var_2022_foreign_Per_1": "foreign_born_share",
    "Var_2022_mobility_1": "pop_1yr_and_older",
    "Var_2022_mobility_2": "different_house_1yr_ago_pop",
    "Var_2022_mobility_3": "lived_outside_msa_1yr_ago_pop",
    "Var_2022_mobility_4": "lived_abroad_1yr_ago_pop",
    "Var_2022_mobility_Per_2": "different_house_1yr_ago_share",
    "Var_2022_mobility_Per_3": "lived_outside_msa_1yr_ago_share",
    "Var_2022_mobility_Per_4": "lived_abroad_1yr_ago_share",
    "Var_2022_hhtype_1": "households_total",
    "Var_2022_hhtype_2": "households_families",
    "Var_2022_hhtype_3": "households_married_couple_family",
    "Var_2022_hhtype_4": "households_other_family",
    "Var_2022_hhtype_5": "households_male_no_spouse",
    "Var_2022_hhtype_6": "households_female_no_spouse",
    "Var_2022_hhtype_7": "households_nonfamily",
    "Var_2022_hhtype_8": "households_living_alone",
    "Var_2022_hhtype_9": "households_not_living_alone",
    "Var_2022_hhtype_Per_2": "share_households_families",
    "Var_2022_hhtype_Per_3": "share_households_married_couple_family",
    "Var_2022_hhtype_Per_4": "share_households_other_family",
    "Var_2022_hhtype_Per_5": "share_households_male_no_spouse",
    "Var_2022_hhtype_Per_6": "share_households_female_no_spouse",
    "Var_2022_hhtype_Per_7": "share_households_nonfamily",
    "Var_2022_hhtype_Per_8": "share_households_living_alone",
    "Var_2022_hhtype_Per_9": "share_households_not_living_alone",
    "Var_2022_vacancy_1": "housing_units_total",
    "Var_2022_vacancy_2": "housing_units_occupied",
    "Var_2022_vacancy_3": "housing_units_vacant",
    "Var_2022_vacancy_Per_2": "share_housing_occupied",
    "Var_2022_vacancy_Per_3": "share_housing_vacant",
    "Var_2022_tenure_1": "occupied_housing_units_total",
    "Var_2022_tenure_2": "owner_occupied_housing_units",
    "Var_2022_tenure_3": "renter_occupied_housing_units",
    "Var_2022_tenure_Per_2": "share_owner_occupied",
    "Var_2022_tenure_Per_3": "share_renter_occupied",
    "Var_2022_LF_1": "pop_16_plus",
    "Var_2022_LF_2": "labor_force_pop",
    "Var_2022_LF_3": "civilian_labor_force_pop",
    "Var_2022_LF_4": "employed_pop",
    "Var_2022_LF_5": "unemployed_pop",
    "Var_2022_LF_6": "armed_forces_pop",
    "Var_2022_LF_7": "not_in_labor_force_pop",
    "Var_2022_LF_Per_2": "share_in_labor_force",
    "Var_2022_LF_Per_3": "share_civilian_labor_force",
    "Var_2022_LF_Per_4": "share_employed",
    "Var_2022_LF_Per_5": "share_unemployed",
    "Var_2022_LF_Per_6": "share_armed_forces",
    "Var_2022_LF_Per_7": "share_not_in_labor_force",
    "Var_2022_poverty_1": "poverty_status_determined_pop",
    "Var_2022_poverty_2": "pop_below_50pct_poverty_threshold",
    "Var_2022_poverty_3": "pop_below_100pct_poverty_threshold",
    "Var_2022_poverty_Per_2": "share_below_50pct_poverty_threshold",
    "Var_2022_poverty_Per_3": "share_below_100pct_poverty_threshold",
    "Var_2022_educ_1": "pop_25_plus",
    "Var_2022_educ_2": "educ_less_than_hs_pop",
    "Var_2022_educ_3": "educ_hs_grad_includes_ged_pop",
    "Var_2022_educ_4": "educ_some_college_includes_assoc_pop",
    "Var_2022_educ_5": "educ_bachelors_or_higher_pop",
    "Var_2022_educ_Per_2": "share_less_than_hs",
    "Var_2022_educ_Per_3": "share_hs_grad_includes_ged",
    "Var_2022_educ_Per_4": "share_some_college_includes_assoc",
    "Var_2022_educ_Per_5": "share_bachelors_or_higher",
    "Var_2022_commuting_1": "workers_16_plus",
    "Var_2022_commuting_2": "commute_car_truck_van_pop",
    "Var_2022_commuting_3": "commute_public_transit_pop",
    "Var_2022_commuting_4": "commute_bicycle_pop",
    "Var_2022_commuting_5": "commute_walked_pop",
    "Var_2022_commuting_6": "commute_other_modes_pop",
    "Var_2022_commuting_7": "commute_worked_from_home_pop",
    "Var_2022_commuting_Per_2": "share_commute_car_truck_van",
    "Var_2022_commuting_Per_3": "share_commute_public_transit",
    "Var_2022_commuting_Per_4": "share_commute_bicycle",
    "Var_2022_commuting_Per_5": "share_commute_walked",
    "Var_2022_commuting_Per_6": "share_commute_other_modes",
    "Var_2022_commuting_Per_7": "share_commute_worked_from_home",
    "Var_2022_income_1": "income_households_total",
    "Var_2022_income_2": "hh_income_under_25k",
    "Var_2022_income_3": "hh_income_25k_to_49k",
    "Var_2022_income_4": "hh_income_50k_to_74k",
    "Var_2022_income_5": "hh_income_75k_to_99k",
    "Var_2022_income_6": "hh_income_100k_to_199k",
    "Var_2022_income_7": "hh_income_200k_plus",
    "Var_2022_income_Per_2": "share_hh_income_under_25k",
    "Var_2022_income_Per_3": "share_hh_income_25k_to_49k",
    "Var_2022_income_Per_4": "share_hh_income_50k_to_74k",
    "Var_2022_income_Per_5": "share_hh_income_75k_to_99k",
    "Var_2022_income_Per_6": "share_hh_income_100k_to_199k",
    "Var_2022_income_Per_7": "share_hh_income_200k_plus",
    "Var_2022_vet_1": "veterans_total",
    "Var_2022_vet_2": "veterans_gulf_war_2001_later",
    "Var_2022_vet_3": "veterans_gulf_war_1990_2001",
    "Var_2022_vet_4": "veterans_vietnam_era",
    "Var_2022_vet_5": "veterans_korean_war",
    "Var_2022_vet_6": "veterans_world_war_ii",
    "Var_2022_vet_7": "veterans_other_periods",
    "Var_2022_vet_Per_2": "share_veterans_gulf_war_2001_later",
    "Var_2022_vet_Per_3": "share_veterans_gulf_war_1990_2001",
    "Var_2022_vet_Per_4": "share_veterans_vietnam_era",
    "Var_2022_vet_Per_5": "share_veterans_korean_war",
    "Var_2022_vet_Per_6": "share_veterans_world_war_ii",
    "Var_2022_vet_Per_7": "share_veterans_other_periods",
}

ID_RENAMES = {
    "Index": "index",
    "NeighborhoodGroup": "neighborhood_group",
    "GeographyType": "geography_type",
}


def load_dict_2022_vars() -> set[str]:
    names: set[str] = set()
    with DICT_PATH.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            vn = (row.get("Variable Name") or "").strip()
            period = (row.get("Period") or "").strip()
            if period == "2022" and vn.startswith("Var_2022_"):
                names.add(vn)
    return names


def main() -> None:
    dict_2022 = load_dict_2022_vars()
    mapped = set(VAR_2022_SEMANTIC)
    if dict_2022 != mapped:
        missing = sorted(dict_2022 - mapped)
        extra = sorted(mapped - dict_2022)
        raise SystemExit(f"Dict vs map mismatch. Missing from map: {missing}\nExtra in map: {extra}")

    with PROFILES.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        old_fields = reader.fieldnames
        assert old_fields
        new_fields: list[str] = []
        rename_pairs: list[tuple[str, str]] = []
        for c in old_fields:
            if c in ID_RENAMES:
                new_fields.append(ID_RENAMES[c])
            elif c in VAR_2022_SEMANTIC:
                new_fields.append(VAR_2022_SEMANTIC[c])
            else:
                raise SystemExit(f"Unexpected column in n_profiles_new.csv: {c!r}")
            rename_pairs.append((c, new_fields[-1]))

        if len(set(new_fields)) != len(new_fields):
            from collections import Counter

            dups = [k for k, v in Counter(new_fields).items() if v > 1]
            raise SystemExit(f"Duplicate new column names: {dups}")

        rows = list(reader)

    with PROFILES.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=new_fields)
        w.writeheader()
        for row in rows:
            w.writerow({new_fields[i]: row[old_fields[i]] for i in range(len(old_fields))})

    with MAP_OUT.open("w", newline="", encoding="utf-8") as f:
        mw = csv.writer(f)
        mw.writerow(["original_column", "semantic_column", "notes"])
        for old, new in rename_pairs:
            mw.writerow([old, new, ""])

    print(f"Wrote {PROFILES} ({len(rows)} rows, {len(new_fields)} cols)")
    print(f"Wrote {MAP_OUT}")


if __name__ == "__main__":
    main()
