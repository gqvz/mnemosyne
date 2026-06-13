#[test_only]
module mnemosyne_contracts::memory_tests;

use mnemosyne_contracts::memory;
use std::unit_test;
use sui::test_scenario::{Self, Scenario};
use sui::clock;

// === Tests ===

#[test]
fun create_namespace_emits_event() {
    let owner = @0xA;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"my-swarm", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun register_agent_by_owner() {
    let owner = @0xA;
    let agent_addr = @0xBEEF;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let reg = memory::register_agent(&mut ns, agent_addr, b"scout", &clock, scenario.ctx());
        unit_test::assert_eq!(memory::agent_count(&ns), 1);
        unit_test::assert_eq!(memory::role(&reg), b"scout");
        test_scenario::return_shared(ns);
        unit_test::destroy(reg);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = memory::ENotAuthorized)]
fun non_owner_cannot_register_agent() {
    let owner = @0xA;
    let attacker = @0xCAFE;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(attacker);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let reg = memory::register_agent(&mut ns, @0xBEEF, b"scout", &clock, scenario.ctx());
        unit_test::destroy(reg);
        test_scenario::return_shared(ns);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun write_memory_from_owner() {
    let owner = @0xA;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let mem = memory::write_memory(
            &mut ns, b"blob-abc", b"hash-def", 0, 2, false, &clock, scenario.ctx(),
        );
        unit_test::assert_eq!(memory::memory_count(&ns), 1);
        unit_test::assert_eq!(memory::blob_id(&mem), b"blob-abc");
        unit_test::assert_eq!(memory::memory_type(&mem), 0);
        unit_test::assert_eq!(memory::encrypted(&mem), false);
        test_scenario::return_shared(ns);
        unit_test::destroy(mem);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = memory::EInvalidMemoryType)]
fun invalid_memory_type_rejected() {
    let owner = @0xA;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let _mem = memory::write_memory(
            &mut ns, b"blob", b"hash", 4, 0, false, &clock, scenario.ctx(),
        );
        unit_test::destroy(_mem);
        test_scenario::return_shared(ns);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun multiple_memories_increment_count() {
    let owner = @0xA;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let m1 = memory::write_memory(&mut ns, b"b1", b"h1", 0, 0, false, &clock, scenario.ctx());
        let m2 = memory::write_memory(&mut ns, b"b2", b"h2", 1, 1, false, &clock, scenario.ctx());
        let m3 = memory::write_memory(&mut ns, b"b3", b"h3", 2, 0, true, &clock, scenario.ctx());
        unit_test::assert_eq!(memory::memory_count(&ns), 3);
        test_scenario::return_shared(ns);
        unit_test::destroy(m1);
        unit_test::destroy(m2);
        unit_test::destroy(m3);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun encrypted_memory_flag() {
    let owner = @0xA;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let enc = memory::write_memory(&mut ns, b"e", b"eh", 1, 0, true, &clock, scenario.ctx());
        let plain = memory::write_memory(&mut ns, b"p", b"ph", 0, 0, false, &clock, scenario.ctx());
        unit_test::assert_eq!(memory::encrypted(&enc), true);
        unit_test::assert_eq!(memory::encrypted(&plain), false);
        test_scenario::return_shared(ns);
        unit_test::destroy(enc);
        unit_test::destroy(plain);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun memory_types_across_range() {
    let owner = @0xA;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let o = memory::write_memory(&mut ns, b"o", b"h", 0, 0, false, &clock, scenario.ctx());
        let d = memory::write_memory(&mut ns, b"d", b"h", 1, 0, false, &clock, scenario.ctx());
        let a = memory::write_memory(&mut ns, b"a", b"h", 2, 0, false, &clock, scenario.ctx());
        let r = memory::write_memory(&mut ns, b"r", b"h", 3, 0, false, &clock, scenario.ctx());
        unit_test::assert_eq!(memory::memory_type(&o), 0);
        unit_test::assert_eq!(memory::memory_type(&d), 1);
        unit_test::assert_eq!(memory::memory_type(&a), 2);
        unit_test::assert_eq!(memory::memory_type(&r), 3);
        test_scenario::return_shared(ns);
        unit_test::destroy(o);
        unit_test::destroy(d);
        unit_test::destroy(a);
        unit_test::destroy(r);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun register_multiple_agents() {
    let owner = @0xA;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        unit_test::destroy(memory::register_agent(&mut ns, @0x1, b"scout", &clock, scenario.ctx()));
        unit_test::assert_eq!(memory::agent_count(&ns), 1);
        unit_test::destroy(memory::register_agent(&mut ns, @0x2, b"strategist", &clock, scenario.ctx()));
        unit_test::assert_eq!(memory::agent_count(&ns), 2);
        unit_test::destroy(memory::register_agent(&mut ns, @0x3, b"executor", &clock, scenario.ctx()));
        unit_test::assert_eq!(memory::agent_count(&ns), 3);
        test_scenario::return_shared(ns);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun different_agents_write_memories() {
    let owner = @0xA;
    let agent1 = @0xAAAA;
    let agent2 = @0xBBBB;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        unit_test::destroy(memory::register_agent(&mut ns, agent1, b"scout", &clock, scenario.ctx()));
        unit_test::destroy(memory::register_agent(&mut ns, agent2, b"strategist", &clock, scenario.ctx()));
        test_scenario::return_shared(ns);
        clock.share_for_testing();
    };

    scenario.next_tx(agent1);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let mem = memory::write_memory(&mut ns, b"a1", b"h1", 0, 0, false, &clock, scenario.ctx());
        unit_test::assert_eq!(memory::agent_id(&mem), agent1);
        test_scenario::return_shared(ns);
        unit_test::destroy(mem);
        clock.share_for_testing();
    };

    scenario.next_tx(agent2);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let mem = memory::write_memory(&mut ns, b"a2", b"h2", 1, 0, false, &clock, scenario.ctx());
        unit_test::assert_eq!(memory::agent_id(&mem), agent2);
        test_scenario::return_shared(ns);
        unit_test::destroy(mem);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = memory::ENotAuthorized)]
fun unauthorized_sender_cannot_write_memory() {
    let owner = @0xA;
    let random_sender = @0xBEEF;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(random_sender);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let mem = memory::write_memory(&mut ns, b"rand", b"h", 0, 0, false, &clock, scenario.ctx());
        test_scenario::return_shared(ns);
        unit_test::destroy(mem);
        clock.share_for_testing();
    };

    scenario.end();
}

#[test]
fun registered_agent_can_write_memory() {
    let owner = @0xA;
    let agent = @0xBEEF;
    let mut scenario = test_scenario::begin(owner);

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        memory::create_namespace(b"ns", &clock, scenario.ctx());
        clock.share_for_testing();
    };

    scenario.next_tx(owner);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let reg = memory::register_agent(&mut ns, agent, b"scout", &clock, scenario.ctx());
        unit_test::destroy(reg);
        test_scenario::return_shared(ns);
        clock.share_for_testing();
    };

    scenario.next_tx(agent);
    {
        let clock = clock::create_for_testing(scenario.ctx());
        let mut ns = scenario.take_shared<memory::Namespace>();
        let mem = memory::write_memory(&mut ns, b"rand", b"h", 0, 0, false, &clock, scenario.ctx());
        unit_test::assert_eq!(memory::agent_id(&mem), agent);
        unit_test::assert_eq!(memory::memory_count(&ns), 1);
        test_scenario::return_shared(ns);
        unit_test::destroy(mem);
        clock.share_for_testing();
    };

    scenario.end();
}
