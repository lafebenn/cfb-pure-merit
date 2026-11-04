import pytest

from cfbml.config import ARTIFACTS_DIR, current_season
from cfbml.sim.season import _real_field, load_context, simulate


def test_real_field_takes_five_champions_even_if_ranked_low():
    order = list(range(1, 31))
    champs = {1, 3, 20, 25, 28, 30}  # top five ranked champs: 1, 3, 20, 25, 28
    field = _real_field(order, champs)
    assert len(field) == 12
    assert {1, 3, 20, 25, 28} <= set(field)
    assert 30 not in field
    assert field == sorted(field)  # straight seeding by committee order


@pytest.mark.skipif(not (ARTIFACTS_DIR / "committee.lgb.txt").exists(), reason="train models first")
def test_simulation_invariants():
    ctx = load_context(current_season())
    teams = simulate(ctx, n_sims=40, chunk=20)["teams"]
    for fmt in ("real", "merit"):
        assert teams[f"{fmt}_playoff"].sum() == pytest.approx(12)
        assert teams[f"{fmt}_bye"].sum() == pytest.approx(4)
        assert teams[f"{fmt}_quarterfinal"].sum() == pytest.approx(8)
        assert teams[f"{fmt}_semifinal"].sum() == pytest.approx(4)
        assert teams[f"{fmt}_final"].sum() == pytest.approx(2)
        assert teams[f"{fmt}_champion"].sum() == pytest.approx(1)
        stages = teams[[f"{fmt}_playoff", f"{fmt}_quarterfinal", f"{fmt}_semifinal",
                        f"{fmt}_final", f"{fmt}_champion"]].to_numpy()
        assert (stages[:, :-1] >= stages[:, 1:] - 1e-12).all()
