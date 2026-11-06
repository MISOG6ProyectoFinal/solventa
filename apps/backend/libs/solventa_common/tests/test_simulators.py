from solventa_common.integration import simulated_provider
from solventa_common.integration.simulators import CLUSTER_SCHEME


def test_simulated_providers_live_in_the_simuladores_service():
    assert simulated_provider("open-finance") == f"{CLUSTER_SCHEME}://simuladores/open-finance"
